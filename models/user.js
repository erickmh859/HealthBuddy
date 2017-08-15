var dynamoose = require('dynamoose');
var bcrypt = require('bcryptjs');

// dynamoose is dynamodb model
var User = module.exports = dynamoose.model('User', {
	email: {
		type: String,
		index: true
	},
	address: {
		type: String
	},
	name: {
		type: String
	},
	nric: {
		type: String
	},
	password: {
		type: String
	},
	phone: {
		type: String
	},
	postalcode: {
		type: String
	}
});

// create caretaker.
module.exports.createUser = function(newUser, callback){
	bcrypt.genSalt(10, function(err, salt) {
	    bcrypt.hash(newUser.password, salt, function(err, hash) {
	        newUser.password = hash;
	        newUser.save(callback);
	    });
	});
}

// get caretaker by email
module.exports.getUserByEmail = function(email, callback){
	var query = {email: email};
	User.queryOne(query, callback);
}
