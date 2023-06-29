require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const _ = require('lodash');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose'); 
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require('mongoose-findorcreate')
const https = require('https');


const homeStartingContent = "Explore a rich tapestry of articles, thought-provoking insights, and heartfelt stories crafted to brighten your day and bring a smile to your face. Join us as we celebrate the beauty of life, uncover hidden gems, and discover the extraordinary in the ordinary.";
const aboutContent = "Hello. I am Samay Sonje. I am currently in VIT college of enginnering in batch of 2024 majoring in computer science. I am a full-stack web developer. I made this project to consolidate my web dev knowledge and showcase my skills by making something that has practical viability.";
const contactContent = "I would love to hear from you! Whether you have a question, feedback, or just want to say hello, feel free to reach out to me. Any suggestion and constructive criticism is welcomed and appreciated! Do consider subscribing to the newsletter for more exiciting stories and articles";

const app = express();

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));


app.use(session({
  secret:process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

const password = process.env.DB_PASSWORD;
const encodedPassword = encodeURIComponent(password);
const db = `mongodb+srv://samaysonje87:${encodedPassword}@cluster0.ea1q8td.mongodb.net/blogdb?retryWrites=true&w=majority`;

mongoose.connect(db).then(function(){
    console.log("connection succcessful");
}).catch(function(err){
    console.log(err);
    console.log("no connection");
})

const postSchema = {
  title: String,
  content: String,
  imageUrl: String
};

const Post = mongoose.model("Post", postSchema);

const memberSchema = new mongoose.Schema({
  username: String,
  password: String,
  googleId: String 
});

memberSchema.plugin(passportLocalMongoose); 
memberSchema.plugin(findOrCreate);

const Member = mongoose.model("Member",memberSchema);
  
passport.use(Member.createStrategy());

// used to serialize the user for the session
passport.serializeUser(function(user, done) {
  done(null, user.id); 
 // where is this user.id going? Are we supposed to access this anywhere?
});

// used to deserialize the user
passport.deserializeUser(function(id, done) {
  Member.findById(id)
    .then(function(user) {
      done(null, user);
    })
    .catch(function(err) {
      done(err, null);
    });
});



passport.use(new GoogleStrategy({
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  // callbackURL: "http://localhost:3000/auth/google/blog",
  callbackURL: "https://blog-project-37cb.onrender.com/auth/google/blog",
  userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
},
function(accessToken, refreshToken, profile, cb) {
  console.log(profile);
  Member.findOrCreate({ googleId: profile.id }, function (err, user) {
    return cb(err, user);
  });
}
));


app.get("/", function(req, res){
  res.render("auth");
});

app.get("/auth/google", passport.authenticate("google",{scope:["profile"]})); 

app.get('/auth/google/blog', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/home');
  });

app.get("/register", function(req, res){
  res.render("register");
});

app.post("/register",function(req,res){
  const username = req.body.username;
  const password = req.body.password;
  const confirmPassword = req.body.confirm;
  if (!username) {
    var error = "Username field is empty.";
    res.render("error", { error: error, redirect: "register" });
    return;
  }
  if (!confirmPassword) {
    var error = "Confirm password field is empty.";
    res.render("error", { error: error, redirect: "register" });
    return;
  }
  if (password !== confirmPassword) {
    var error = "Password and confirm password do not match.";
    res.render("error", { error: error, redirect: "register" });
    return;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(username)) {
    var error = "Invalid email format.";
    res.render("error", { error: error, redirect: "register" });
    return;
  }

  Member.register({username: req.body.username},req.body.password,function(err,member){
    if(err){
      // or take them to error page
      console.log(err);
      res.render("error",{error:err, redirect: "register"})
    }else{
      passport.authenticate("local")(req,res,function(){
        res.redirect("/home");
      })
    }
  })
});

app.get("/login", function(req, res){
  res.render("login");
});


app.post("/login", function(req, res) {
  const username = req.body.username;
  const password = req.body.password;

  if (!username) {
    var error = "Username field is empty.";
    res.render("error", { error: error, redirect: "login" });
    return;
  }

  if (!password) {
    var error = "Password field is empty.";
    res.render("error", { error: error, redirect: "login" });
    return;
  }

  Member.findOne({ username: username }).then(function(exists) {
    
    
    if (exists) {
      if(password !== exists.password){
        var error = "This email is registered but the password is incorrect. Try logging in again!";
        res.render("error", { error: error, redirect: "login" });
        return;  
      }
    }else{
      var error = "This email is not registered. Try registering instead";
      res.render("error", { error: error, redirect: "login" });
      return;
    }


    const member = new Member({
      username: username,
      password: password
    });

    req.login(member, function(err) {
      if (err) {
        console.log(err);
        res.render("error", { error: err, redirect: "login" });
      } else {
        passport.authenticate("local")(req, res, function() {
          res.redirect("/home");
        });
      }
    });
  });
});





app.get("/logout", function(req, res){
  req.logout(function(err){
    if(err){
      console.log(err);
    }else{
      res.redirect("/");
    }
  });
})

app.get("/home", function(req, res){
  if(req.isAuthenticated()){
    Post.find({}).then(function(posts){
      res.render("home", {
        homeStartingContentVar: homeStartingContent,
        posts: posts
        });
    });
  }else{
    res.redirect("/login");
  }
});


app.get("/compose", function(req, res){
  res.render("compose");
});

app.post("/compose", function(req, res){
  const post = new Post({
    title: req.body.postTitle,
    content: req.body.postBody,
    imageUrl: req.body.imageUrl
  });


  post.save().then(function(){
      res.redirect("/home#blogs")
  }).catch(function(err){
      console.log(err);
  })
});

app.get("/posts/:postId", function(req, res){

const requestedPostId = req.params.postId;

  Post.findOne({_id: requestedPostId}).then(function(post){
    res.render("post", {
      title: post.title,
      content: post.content,
      imageUrl: post.imageUrl
    });
  }).catch(function(err){
    console.log(err);
  })

});


app.get("/about",function(req,res){
  res.render("about",{aboutContentVar:aboutContent});
})

app.get("/contact",function(req,res){
  res.render("contact",{contactContentVar:contactContent});
})

app.get("/admin",function(req,res){
  res.render("admin")
})

app.post("/admin",function(req,res){
  const admin = req.body.admin
  if(admin===process.env.ADMIN_PASSWORD){
    res.redirect("compose")
  }else{
    const error = "Admin password is incorrect!"
    res.render("error",{error:error, redirect: "home"})
  }
})

app.get("/newsletter",function(req,res){
  res.render("newsletter");
})

app.post("/newsletter",function(req,res){
  const fname = req.body.fname;
  const lname = req.body.lname;
  const email = req.body.email;

  const data = {
    members:[
      {
        email_address: email,
        status:"subscribed",
        merge_fields:{
            FNAME: fname,
            LNAME: lname
        }
      }
    ]
  }

  const jsonData = JSON.stringify(data);
  const list_id = process.env.AUDIENCE_ID
  const api_key = process.env.API_KEY
  const url=`https://us12.api.mailchimp.com/3.0/lists/${list_id}`
  const options = {
    method: "POST",
    auth:`samay:${api_key}`
  }
  const request = https.request(url,options,function(response){
    response.on("data",function(data){
      const code = response.statusCode;
      console.log(code);
      if(code==200){
        res.render("success");
      }else{
        res.render("error",{error:response.error, redirect: "newsletter"})
      }
      // console.log(JSON.parse(data));
    })
  })

  request.write(jsonData);
  request.end();

})

app.listen(process.env.PORT || 3000, function() {
  console.log("Server started on port 3000");
});
