const {validateData} = require('./routes/data');

// Test function
async function testValidation() {
    try {
        const result = await validateData('./csv/diabetes.csv');
        console.log('Validation Result:', result);
    } catch (error) {
        console.error('Validation Error:', error);
    }
}

// Run the test
testValidation();