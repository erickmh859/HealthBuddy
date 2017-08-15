var express = require('express');
var router = express.Router();
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var aws = require('aws-sdk');
var docClient = new aws.DynamoDB.DocumentClient();
var bcrypt = require('bcryptjs');


var user = require('../models/user'); // user model for caretaker registration

// Register
router.get('/register', function(req, res){
	res.render('register');
});

// Login
router.get('/login', function(req, res){
	res.render('login');
});

// Index
router.get('/index', function(req, res){
		res.render('index');
});

// Display
router.get('/display', function(req, res, next){
	var email = req.user.email; //global email variable

	// Taking phone value link with email in dynamodb
	var params = {
        TableName:"ElderlyL",
        ProjectionExpression:"ePhone",
        KeyConditionExpression:"#email = :emailValue",
        ExpressionAttributeNames: {
            "#email":"ctEmail"
            },
        ExpressionAttributeValues: {
            ":emailValue":email
            },
        };

	docClient.query(params, function(err, data) {
		if (err) {
      		console.log(err);
    	}
    	else { 
    		console.log(data.Items[0]["ePhone"]);
    		var phone = data.Items[0]["ePhone"];
 
 			// Taking name of the elderly by using phone number
    		var params = {
    			TableName:"Elderly",
    			ProjectionExpression:"eName",
    			KeyConditionExpression:"#phone = :phoneValue",
    			ExpressionAttributeNames: {
    				"#phone":"ePhone"
    			},
    			ExpressionAttributeValues: {
    				":phoneValue":phone
    			}
    		};
    		docClient.query(params, function(err, data) {
    			console.log(data.Items[0]["eName"]);
    			var name = data.Items[0]["eName"];
    			var phone2 = phone;
    			console.log(phone2);

    			// Taking locations of the phone number from dynamodb
    			var params = {
    			TableName:"ElderlyLocate",
    			ProjectionExpression:["eAddress, ePostal, eLan, eLong, eDate, eTime"],
    			KeyConditionExpression:"#phone = :phoneValue",
    			ExpressionAttributeNames: {
    				"#phone":"ePhone"
    			},
    			ExpressionAttributeValues: {
    				":phoneValue":phone2
    			},
    			ScanIndexForward: true
    			};
    			docClient.query(params, function(err,data) {
    				if (err) {
        				console.error("Unable to add item. Error JSON:", JSON.stringify(err, null, 2));
    				} else {
        				console.log(data.Items);
        				console.log(data.length);
        				res.render('display.ejs', {_cPhone : phone2, _cName : name, _cLocation : data.Items}); // Passing variables to the ejs page
    				}
    			});
    		});	
		}
	});
});

// Register User
router.post('/register', function(req, res){
	var name = req.body.name;
	var email = req.body.email;
	var password = req.body.password;
	var password2 = req.body.password2;
	var nric = req.body.nric;
	var phone = req.body.phone;
	var address = req.body.address;
	var postalcode = req.body.postalcode;


	// Validation
	req.checkBody('name', 'Name is required').notEmpty();
	req.checkBody('email', 'Email is required').notEmpty();
	req.checkBody('email', 'Email is not valid').isEmail();
	req.checkBody('password', 'Password is required').notEmpty();
	req.checkBody("password", 'Password should be combination of one uppercase , one lower case, one digit and min 8').matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])[0-9a-zA-Z]{8,}$/, "i");
	req.checkBody('password2', 'Passwords do not match').equals(req.body.password);
	req.checkBody('nric', 'NRIC is required').notEmpty();
	req.checkBody('phone', 'Phone is required').notEmpty();
	req.checkBody('phone', 'Phone must be 8 digit').matches(/^[0-9]{8}$/);
	req.checkBody('address', 'Address is required').notEmpty();
	req.checkBody('postalcode', 'Postal Code is required').notEmpty();
	req.checkBody('postalcode', 'Postal must be 6 digit').matches(/^[0-9]{6}$/);

	var errors = req.validationErrors();

	if(errors){
		res.render('register',{
			errors:errors
		});
	} else {
		// passing from website to model
		var newUser = new user({
			email:email,
			address: address,
			name: name,
			nric: nric,
			password: password,
			phone: phone,
			postalcode: postalcode
		});
		// function declare in user.js
		user.createUser(newUser, function(err, user){
			if(err) throw err;
			console.log(user);
		});

		req.flash('success_msg', 'You are registered and can now login');

		res.redirect('/users/login');
	}
});


// Login authentication
passport.use(new LocalStrategy(
  function(email, password, done) {
   user.getUserByEmail(email, function(err, user){
   	if(err) throw err;
   	if(!user){
   		return done(null, false, {message: 'Unknown User'});
   	}

   	bcrypt.compare(password, user.password, function(err, isMatch){
   		if(err) throw err;
   		if(isMatch){
   			return done(null, user);
   		} else {
   			return done(null, false, {message: 'Invalid password'});
   		}
   	});
   });
  }));

passport.serializeUser(function(user, done) {
  done(null, user.email);
});

passport.deserializeUser(function(email, done) {
  user.getUserByEmail(email, function(err, user) {
    done(err, user);
  });
});

router.post('/login',
  passport.authenticate('local', {successRedirect:'/', failureRedirect:'/users/login',failureFlash: true}),
  function(req, res) {
    res.redirect('/');
  });

//Assigning number of elderly to caretaker
router.post('/index', function(req, res){
	var email = req.user.email;
	var phone = req.body.phone;
	var items = [];
	var match = false;

	req.checkBody('phone', 'Phone is required').notEmpty();

	var errors = req.validationErrors();

	if(errors){
		res.render('index',{
			errors:errors
		});
	} else {
		//scanning the whole table
		var params = {
			TableName:"ElderlyL",
		};
		docClient.scan(params, function(err, data) {
			if (err) {
				console.log(JSON.stringify(err, null, 2));
			} else {
				console.log(JSON.stringify(data, null, 2));
				//pushing items scan into array
				items.push(data.Items);
				console.log(items);
				console.log(items[0][0]["ctEmail"]);
				console.log(items[0].length);
				// loop through and check for existing phone or email
				for (var i = 0; j = items[0].length, i < j; i++){
					var bool = email == items[0][i]["ctEmail"] || phone == items[0][i]["ePhone"];
					console.log(bool);
					if (email == items[0][i]["ctEmail"] || phone == items[0][i]["ePhone"]) {
						match = true;
						{break;}
					} 
				}
				//validation
				if (match) {
					req.flash('success_msg', 'Email or Phone already assigned to a number, Please contact Admin');
						res.redirect('/');

				} else {
					//inserting link record
					var params = {
   						TableName:"ElderlyL",
    					Item:{
        					"ctEmail": email,
        					"ePhone": phone
    					}
					};

					console.log("Adding a new item...");
					docClient.put(params, function(err, data) {
    					if (err) {
        					console.error("Unable to add item. Error JSON:", JSON.stringify(err, null, 2));
    					} else {
        					console.log("Added item:", JSON.stringify(data, null, 2));
        					req.flash('success_msg', 'Succesfully assigned');

							res.redirect('/');
    					}
					});
				}
			}
			
		});
	}
});

 var request = require("request");

    var options = { method: 'POST',
      url: 'https://developers.onemap.sg/privateapi/auth/post/getToken',
      headers: 
       { 'cache-control': 'no-cache',
         'content-type': 'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW' },
      formData: { email: 'erickmh859@gmail.com', password: 'onemap20' } };

    request(options, function (error, response, body) {
      if (error) throw new Error(error);

      console.log(body);
    });


//logout
router.get('/logout', function(req, res){
	req.logout();

	req.flash('success_msg', 'You are logged out');

	res.redirect('/users/login');
});

module.exports = router;