/**
 * ============================================================================
 * K9 Harmony - Event Service (Error Handling Unified)
 * ============================================================================
 * バージョン: v2.0.0 - エラーハンドリング統一版
 * 最終更新: 2026-01-04
 */

var EventService = {
  
  createEvent: function(eventData) {
    var context = { service: 'EventService', action: 'createEvent' };
    
    try {
      log('INFO', 'EventService', 'Creating event');
      
      Validator.required(eventData, ['event_name', 'event_date', 'event_location', 'max_participants']);
      
      var event = {
        event_id: Utilities.getUuid(),
        event_code: this._generateEventCode(),
        event_name: eventData.event_name,
        event_type: eventData.event_type || 'GROUP_LESSON',
        event_date: eventData.event_date,
        event_location: eventData.event_location,
        event_description: eventData.event_description || '',
        max_participants: eventData.max_participants,
        current_participants: 0,
        event_price: eventData.event_price || 0,
        event_status: 'SCHEDULED',
        created_at: new Date(),
        updated_at: new Date()
      };
      
      DB.insert(CONFIG.SHEET.EVENTS, event);
      
      log('INFO', 'EventService', 'Event created: ' + event.event_code);
      
      return {
        success: true,
        event: event,
        message: 'イベントを作成しました'
      };
      
    } catch (error) {
      return ErrorHandler.handle(error, context);
    }
  },
  
  updateEvent: function(eventId, updateData) {
    var context = { service: 'EventService', action: 'updateEvent' };
    
    try {
      log('INFO', 'EventService', 'Updating event: ' + eventId);
      
      updateData.updated_at = new Date();
      
      var event = DB.update(CONFIG.SHEET.EVENTS, eventId, updateData);
      
      if (!event) {
        throw createK9Error(
          ErrorCode.RECORD_NOT_FOUND,
          'Event not found',
          { eventId: eventId }
        );
      }
      
      log('INFO', 'EventService', 'Event updated: ' + eventId);
      
      return {
        success: true,
        event: event,
        message: 'イベント情報を更新しました'
      };
      
    } catch (error) {
      return ErrorHandler.handle(error, context);
    }
  },
  
  cancelEvent: function(eventId, reason) {
    var context = { service: 'EventService', action: 'cancelEvent' };
    
    try {
      log('INFO', 'EventService', 'Cancelling event: ' + eventId);
      
      var event = DB.findById(CONFIG.SHEET.EVENTS, eventId);
      
      if (!event) {
        throw createK9Error(
          ErrorCode.RECORD_NOT_FOUND,
          'Event not found',
          { eventId: eventId }
        );
      }
      
      DB.update(CONFIG.SHEET.EVENTS, eventId, {
        event_status: 'CANCELLED',
        cancellation_reason: reason || '',
        cancelled_at: new Date(),
        updated_at: new Date()
      });
      
      var applications = DB.findBy(CONFIG.SHEET.EVENT_APPLICATIONS, 'event_id', eventId);
      
      applications.forEach(function(app) {
        if (app.application_status === 'CONFIRMED') {
          DB.update(CONFIG.SHEET.EVENT_APPLICATIONS, app.application_id, {
            application_status: 'CANCELLED',
            updated_at: new Date()
          });
          
          var customer = DB.findById(CONFIG.SHEET.CUSTOMERS, app.customer_id);
          
          if (customer && customer.line_user_id && typeof NotificationService !== 'undefined') {
            this._sendEventCancellationNotice(event, customer, reason);
          }
        }
      }.bind(this));
      
      log('INFO', 'EventService', 'Event cancelled: ' + eventId);
      
      return {
        success: true,
        message: 'イベントをキャンセルしました'
      };
      
    } catch (error) {
      return ErrorHandler.handle(error, context);
    }
  },
  
  applyForEvent: function(eventId, customerId, dogIds, applicationData) {
    var context = { service: 'EventService', action: 'applyForEvent' };
    
    try {
      log('INFO', 'EventService', 'Applying for event: ' + eventId);
      
      var event = DB.findById(CONFIG.SHEET.EVENTS, eventId);
      
      if (!event) {
        throw createK9Error(
          ErrorCode.RECORD_NOT_FOUND,
          'Event not found',
          { eventId: eventId }
        );
      }
      
      if (event.event_status !== 'SCHEDULED') {
        throw createK9Error(
          ErrorCode.VALIDATION_ERROR,
          'このイベントは申込できません',
          { status: event.event_status }
        );
      }
      
      if (event.current_participants >= event.max_participants) {
        throw createK9Error(
          ErrorCode.VALIDATION_ERROR,
          'イベントは満員です',
          { current: event.current_participants, max: event.max_participants }
        );
      }
      
      var application = {
        application_id: Utilities.getUuid(),
        application_code: this._generateApplicationCode(),
        event_id: eventId,
        customer_id: customerId,
        dog_ids: Array.isArray(dogIds) ? dogIds.join(',') : dogIds,
        application_date: new Date(),
        application_status: 'CONFIRMED',
        payment_status: applicationData.payment_status || 'PENDING',
        total_amount: event.event_price || 0,
        notes: applicationData.notes || '',
        created_at: new Date(),
        updated_at: new Date()
      };
      
      DB.insert(CONFIG.SHEET.EVENT_APPLICATIONS, application);
      
      DB.update(CONFIG.SHEET.EVENTS, eventId, {
        current_participants: event.current_participants + 1,
        updated_at: new Date()
      });
      
      var customer = DB.findById(CONFIG.SHEET.CUSTOMERS, customerId);
      
      if (customer && customer.line_user_id && typeof NotificationService !== 'undefined') {
        NotificationService.sendEventConfirmation(event, customer);
      }
      
      log('INFO', 'EventService', 'Application created: ' + application.application_code);
      
      return {
        success: true,
        application: application,
        message: 'イベントに申し込みました'
      };
      
    } catch (error) {
      return ErrorHandler.handle(error, context);
    }
  },
  
  cancelApplication: function(applicationId, reason) {
    var context = { service: 'EventService', action: 'cancelApplication' };
    
    try {
      log('INFO', 'EventService', 'Cancelling application: ' + applicationId);
      
      var application = DB.findById(CONFIG.SHEET.EVENT_APPLICATIONS, applicationId);
      
      if (!application) {
        throw createK9Error(
          ErrorCode.RECORD_NOT_FOUND,
          'Application not found',
          { applicationId: applicationId }
        );
      }
      
      DB.update(CONFIG.SHEET.EVENT_APPLICATIONS, applicationId, {
        application_status: 'CANCELLED',
        cancellation_reason: reason || '',
        cancelled_at: new Date(),
        updated_at: new Date()
      });
      
      var event = DB.findById(CONFIG.SHEET.EVENTS, application.event_id);
      
      if (event) {
        DB.update(CONFIG.SHEET.EVENTS, application.event_id, {
          current_participants: Math.max(0, event.current_participants - 1),
          updated_at: new Date()
        });
      }
      
      log('INFO', 'EventService', 'Application cancelled: ' + applicationId);
      
      return {
        success: true,
        message: 'イベント申込をキャンセルしました'
      };
      
    } catch (error) {
      return ErrorHandler.handle(error, context);
    }
  },
  
  getEventList: function(filters) {
    var context = { service: 'EventService', action: 'getEventList' };
    
    try {
      var events = DB.fetchTable(CONFIG.SHEET.EVENTS);
      
      if (filters) {
        if (filters.status) {
          events = events.filter(function(e) {
            return e.event_status === filters.status;
          });
        }
        
        if (filters.type) {
          events = events.filter(function(e) {
            return e.event_type === filters.type;
          });
        }
        
        if (filters.dateFrom) {
          var dateFrom = new Date(filters.dateFrom);
          events = events.filter(function(e) {
            return new Date(e.event_date) >= dateFrom;
          });
        }
        
        if (filters.dateTo) {
          var dateTo = new Date(filters.dateTo);
          events = events.filter(function(e) {
            return new Date(e.event_date) <= dateTo;
          });
        }
      }
      
      events.sort(function(a, b) {
        return new Date(a.event_date) - new Date(b.event_date);
      });
      
      return {
        success: true,
        events: events
      };
      
    } catch (error) {
      return ErrorHandler.handle(error, context);
    }
  },
  
  getEventApplications: function(eventId) {
    var context = { service: 'EventService', action: 'getEventApplications' };
    
    try {
      var applications = DB.findBy(CONFIG.SHEET.EVENT_APPLICATIONS, 'event_id', eventId);
      
      var enrichedApplications = applications.map(function(app) {
        var customer = DB.findById(CONFIG.SHEET.CUSTOMERS, app.customer_id);
        
        if (customer) {
          app.customer_name = customer.customer_name;
          app.customer_phone = customer.customer_phone;
        }
        
        return app;
      });
      
      return {
        success: true,
        applications: enrichedApplications
      };
      
    } catch (error) {
      return ErrorHandler.handle(error, context);
    }
  },
  
  getCustomerApplications: function(customerId) {
    var context = { service: 'EventService', action: 'getCustomerApplications' };
    
    try {
      var applications = DB.findBy(CONFIG.SHEET.EVENT_APPLICATIONS, 'customer_id', customerId);
      
      var enrichedApplications = applications.map(function(app) {
        var event = DB.findById(CONFIG.SHEET.EVENTS, app.event_id);
        
        if (event) {
          app.event_name = event.event_name;
          app.event_date = event.event_date;
          app.event_location = event.event_location;
          app.event_status = event.event_status;
        }
        
        return app;
      });
      
      enrichedApplications.sort(function(a, b) {
        return new Date(b.event_date) - new Date(a.event_date);
      });
      
      return {
        success: true,
        applications: enrichedApplications
      };
      
    } catch (error) {
      return ErrorHandler.handle(error, context);
    }
  },
  
  sendEventReminders: function(eventId) {
    var context = { service: 'EventService', action: 'sendEventReminders' };
    
    try {
      log('INFO', 'EventService', 'Sending event reminders: ' + eventId);
      
      var event = DB.findById(CONFIG.SHEET.EVENTS, eventId);
      
      if (!event) {
        throw createK9Error(
          ErrorCode.RECORD_NOT_FOUND,
          'Event not found',
          { eventId: eventId }
        );
      }
      
      var applications = DB.findBy(CONFIG.SHEET.EVENT_APPLICATIONS, 'event_id', eventId);
      
      var successCount = 0;
      var failCount = 0;
      
      applications.forEach(function(app) {
        if (app.application_status !== 'CONFIRMED') return;
        
        var customer = DB.findById(CONFIG.SHEET.CUSTOMERS, app.customer_id);
        
        if (!customer || !customer.line_user_id) {
          failCount++;
          return;
        }
        
        if (typeof NotificationService !== 'undefined') {
          var result = NotificationService.sendEventNotification(event);
          
          if (result.success) {
            successCount++;
          } else {
            failCount++;
          }
        }
      });
      
      DB.update(CONFIG.SHEET.EVENTS, eventId, {
        reminder_sent: true,
        reminder_sent_at: new Date(),
        updated_at: new Date()
      });
      
      log('INFO', 'EventService', 'Event reminders sent: ' + successCount + ' success, ' + failCount + ' failed');
      
      return {
        success: true,
        successCount: successCount,
        failCount: failCount
      };
      
    } catch (error) {
      return ErrorHandler.handle(error, context);
    }
  },
  
  _generateEventCode: function() {
    var date = new Date();
    var year = date.getFullYear().toString().slice(-2);
    var month = ('0' + (date.getMonth() + 1)).slice(-2);
    var random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    
    return 'EV' + year + month + '-' + random;
  },
  
  _generateApplicationCode: function() {
    var date = new Date();
    var year = date.getFullYear().toString().slice(-2);
    var month = ('0' + (date.getMonth() + 1)).slice(-2);
    var random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    
    return 'AP' + year + month + '-' + random;
  },
  
  _sendEventCancellationNotice: function(event, customer, reason) {
    try {
      var date = Utilities.formatDate(new Date(event.event_date), 'JST', 'M月d日(E) HH:mm');
      
      var message = {
        type: 'text',
        text: customer.customer_name + ' 様\n\n' +
              'イベントが中止となりました。\n' +
              '誠に申し訳ございません。\n\n' +
              '【中止イベント】\n' +
              'イベント名: ' + event.event_name + '\n' +
              '日時: ' + date + '\n' +
              'イベントコード: ' + event.event_code + '\n\n' +
              (reason ? '理由: ' + reason + '\n\n' : '') +
              'またのご参加をお待ちしております。'
      };
      
      NotificationService._sendLineMessage(customer.line_user_id, message);
      
      log('INFO', 'EventService', 'Event cancellation notice sent to: ' + customer.customer_name);
      
    } catch (error) {
      log('ERROR', 'EventService', 'Failed to send cancellation notice: ' + error.message);
    }
  }
};

function TEST_CreateEvent() {
  console.log('=== Create Event Test ===\n');
  
  var eventData = {
    event_name: 'お花見ドッグラン',
    event_type: 'GROUP_LESSON',
    event_date: '2026-04-05 10:00:00',
    event_location: '代々木公園ドッグラン',
    event_description: '桜の季節に愛犬と一緒にお花見を楽しみましょう！',
    max_participants: 20,
    event_price: 3000
  };
  
  var result = EventService.createEvent(eventData);
  
  if (result.error) {
    console.error('❌ エラー:', result.message);
  } else {
    console.log('✅ イベント作成成功');
    console.log('   イベントコード:', result.event.event_code);
    console.log('   イベント名:', result.event.event_name);
    console.log('   開催日:', result.event.event_date);
  }
}

function TEST_EventApplication() {
  console.log('=== Event Application Test ===\n');
  
  var events = DB.fetchTable(CONFIG.SHEET.EVENTS);
  
  if (events.length === 0) {
    console.log('❌ イベントがありません');
    return;
  }
  
  var event = events[0];
  console.log('テスト対象イベント:', event.event_code);
  
  var customers = DB.fetchTable(CONFIG.SHEET.CUSTOMERS);
  
  if (customers.length === 0) {
    console.log('❌ 顧客がいません');
    return;
  }
  
  var customer = customers[0];
  var dogs = DB.findBy(CONFIG.SHEET.DOGS, 'customer_id', customer.customer_id);
  
  var result = EventService.applyForEvent(
    event.event_id,
    customer.customer_id,
    dogs.length > 0 ? [dogs[0].dog_id] : [],
    { payment_status: 'PAID' }
  );
  
  if (result.error) {
    console.error('❌ エラー:', result.message);
  } else {
    console.log('✅ イベント申込成功');
    console.log('   申込コード:', result.application.application_code);
    console.log('   顧客:', customer.customer_name);
  }
}