var express = require('express')
var app = express();
var bodyParser = require('body-parser');
var anyDB = require('any-db');
var engines = require('consolidate');
var path = require('path');

var http = require('http');
var server = http.createServer(app);

//add socket.io
var io = require('socket.io').listen(server)



// you will probably need to require more dependencies here.
var conn = anyDB.createConnection('sqlite3://chatroom.db');

app.engine('html', engines.hogan); // tell Express to run .html files through Hogan
app.set('views', __dirname + '/templates'); // tell Express where to find templates, in this case the '/templates' directory
app.set('view engine', 'html'); //register .html extension as template engine so we can render .html pages

// your app's code here
app.use(bodyParser.urlencoded({extended:true}));
app.use(bodyParser.json());

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static('public'));
app.use("/static", express.static("public"));

conn.query('CREATE TABLE IF NOT EXISTS message ( id INTEGER PRIMARY KEY AUTOINCREMENT, room TEXT, nickname TEXT, body TEXT, time INTEGER)')
conn.query('CREATE TABLE IF NOT EXISTS roomInfo ( roomName TEXT, roomID TEXT PRIMARY KEY)')



var users = [];

var randomId = "";

function getNames() {
  var userNames = [];

  for (var x = 0; x < users.length; x++) {
    userNames.push(users[x].nickname);
  }

  return userNames;
}

io.sockets.on('connection', function(socket){

    // handle a newly-connected socket
    // users.push(socket);
    //
    // // add event handlers for this user
    // socket.on('disconnect', function(){
    //
    //     var idx = users.indexOf(socket);
    //     users.splice(idx, 1);
    //
    //     io.sockets.in(randomId).emit('newMember', getNames())
    //
    // });
    //
    // socket.on('message', function(msg_obj){
    //
    //    let id = msg_obj.theChatSpaceID;
    //    let userName =  msg_obj.userName;
    //    let message =  msg_obj.message;
    //    let time =  msg_obj.date ;
    //
    //    console.log('MESSAGE\n' + message);
    //
    //     conn.query("INSERT INTO message(room , nickname , body , time ) VALUES(?, ?, ?, ?)", [ id,
    //       userName , message, time ] );
    //
    //     io.sockets.in(id).emit('message', userName, message, time);
    //
    //
    // });
    //
    // socket.on('nickname', function(nickname, id){
    //     console.log('INPUTING NAME');
    //     socket.nickname = nickname; //giving socket  a property named nickname & then setting to nickname that is passed in
    //     io.sockets.in(id).emit('newMember', getNames() );
    // });
    //
    socket.on('join', function(id, nickname, callback){

        console.log('joining this thing');
        socket.join(id);
        socket.nickname = nickname;
        randomId = id;
        conn.query("SELECT * FROM message WHERE room = ? ORDER BY time" , [id], function(err, data) {
            let object = { rows : data.rows};

            callback(data.rows);

        });
        io.sockets.in(id).emit('newMember', getNames() );
    });


});

//----------------------------------------------------------------------




app.get('/', function(request, response) {
  let identifier = generateRoomIdentifier();
  var object = { newRoom: identifier };
  response.render('main.html', object);
  //sendFIle is only static files
});

app.post('/room/:id', makeNewRoom);

app.get('/room/:id', function(request, response) {
  console.log(request);
  conn.query('SELECT roomName from roomInfo WHERE roomId = ?', [request.params.id], function(error, result) {
      let roomName = "NO GIVEN NAME";
      if (result.rows.length > 0) {
        chatRoomName = result.rows[0].roomName
      }
      let object = {theChatSpaceID: request.params.id, theChatSpaceName: roomName};
      response.render('namedRoom.html', object)

  });
});

function thereIsARoom(room) {
  conn.query("SELECT * from roomInfo WHERE roomID = ?", [room], function(error, result) {
      if(result.rows.length > 0) {
        return false;
      }
        return true;
  });

}


function generateRoomIdentifier() {
  // make a list of legal characters
  // we're intentionally excluding 0, O, I, and 1 for readability
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  var result = '';
  for (var i = 0; i < 6; i++)
    result += chars.charAt(Math.floor(Math.random() * chars.length));

  while( thereIsARoom(result)) {
    result = generateRoomIdentifier();
  }

  return result;
}

function makeNewRoom(request, response) {
    let theChatSpaceName = request.body.theChatSpaceName;
    let theChatSpaceID= request.body.theChatSpaceID;
    conn.query("INSERT INTO roomInfo(roomName, roomID) VALUES(?,?)", [theChatSpaceName, theChatSpaceID]);
    response.render('namedRoom.html', {theChatSpaceName: theChatSpaceName , theChatSpaceID : theChatSpaceID})
}

//"this endpoint matches so the server is a place where you handle the endpoints"
app.post('/:roomId/gotMsg', function(request, response) {
  let theChatSpaceID = request.body.theChatSpaceID;
  let userName= request.body.userName;
  let message= request.body.message;
  let date= request.body.date;


  conn.query("INSERT INTO message(room , nickname , body , time ) VALUES(?, ?, ?, ?)", [theChatSpaceID, userName, message, date]);
});


//1. Qeury, 2. function, 3. send it with response | because js is asynch so things happen in the order you dont want it to :'('
app.post('/findMessages', function(request, response) {
  conn.query("SELECT * FROM message WHERE room = ? ORDER BY time" , [request.body.roomId], function(err, data) {

      let object = { rows : data.rows};
      response.send(object);
  });
});

app.get('/delete', function(request, response) {
  conn.query('DELETE * FROM roomInfo');
  conn.query('DELETE * FROM message');
});



server.listen(8180);
console.log('Server Starting');
