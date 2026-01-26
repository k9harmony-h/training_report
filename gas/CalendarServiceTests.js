/**
 * CalendarService統合テスト
 */
function testCalendarServiceIntegration() {
  console.log('=== CalendarService Integration Test ===\n');
  
  // テストパラメータ
  var params = {
    year: 2026,
    month: 2,
    trainer_code: 'TRN-001',
    is_multiple_dogs: false
  };
  
  console.log('Testing with params:', JSON.stringify(params));
  
  try {
    var result = getMonthAvailability(params);
    
    if (result.success) {
      console.log('✅ Success!');
      console.log('Year:', result.year);
      console.log('Month:', result.month);
      console.log('Trainer:', result.trainer_name);
      console.log('Lesson Duration:', result.lesson_duration + ' minutes');
      console.log('Max Advance Days:', result.max_advance_days);
      
      // 最初の5日分の空き枠を表示
      var dates = Object.keys(result.availability).sort().slice(0, 5);
      console.log('\nFirst 5 days availability:');
      dates.forEach(function(date) {
        var slots = result.availability[date];
        console.log('  ' + date + ': ' + slots.length + ' slots');
        if (slots.length > 0) {
          console.log('    → ' + slots.slice(0, 3).join(', ') + '...');
        }
      });
      
    } else {
      console.log('❌ Error:', result.error);
      if (result.error_details) {
        console.log('Details:', result.error_details);
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
  
  console.log('\n=== Test Completed ===');
}
/**
 * Main.gs経由でのCalendarService呼び出しテスト
 */
function testMainGetMonthAvailability() {
  console.log('=== Main.gs Integration Test ===\n');
  
  // POSTリクエストをシミュレート
  var mockPostData = {
    contents: JSON.stringify({
      action: 'getMonthAvailability',
      userId: 'U1d95daf0e8dfe55a2d5f22442fcddf2f', // じゅんさんのLINE User ID
      year: 2026,
      month: 3,
      trainer_code: 'TRN-001',
      is_multiple_dogs: false
    })
  };
  
  var mockRequest = {
    postData: mockPostData
  };
  
  try {
    console.log('Calling doPost with getMonthAvailability action...');
    
    var response = doPost(mockRequest);
    var content = response.getContent();
    var data = JSON.parse(content);
    
    console.log('\n✅ Response received');
    console.log('Error flag:', data.error);
    
    if (!data.error) {
      console.log('✅ Success!');
      console.log('Year:', data.year);
      console.log('Month:', data.month);
      console.log('Trainer:', data.trainer_name);
      console.log('Lesson Duration:', data.lesson_duration);
      
      var dates = Object.keys(data.availability).sort();
      console.log('Total dates:', dates.length);
      console.log('First 3 dates:');
      dates.slice(0, 3).forEach(function(date) {
        console.log('  ' + date + ': ' + data.availability[date].length + ' slots');
      });
    } else {
      console.log('❌ Error:', data.message || data.code);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
  
  console.log('\n=== Test Completed ===');
}