// requires the Express web framework, used for routing HTTP requests and to facilitate resource sharing from server to client.
var express = require('express')
  , app = express(app)
  , server = require('http').createServer(app);

// serve static files from the current directory, allowing the client to access the server resources, such as sounds/sprites
app.use(express.static(__dirname));

//list to hold clients
var clients = {};
  
//get EurecaServer class
var EurecaServer = require('eureca.io').EurecaServer;

//create an instance of EurecaServer and define functions that can be called remotely on the client side from the server.
var eurecaServer = new EurecaServer({allow:['setId', 'spawnEnemy', 'kill', 'updateState', 'killing']});

//attach eureca.io to our http server
eurecaServer.attach(server);

//eureca.io provides events to detect clients connect/disconnect

//detect client connection
eurecaServer.onConnect(function (conn) {    
    console.log('New Client id=%s ', conn.id, conn.remoteAddress);
	
	//the getClient method provide a proxy allowing us to call remote client functions
    var remote = eurecaServer.getClient(conn.id);    
	
	//register the client in the clients list
	clients[conn.id] = {id:conn.id, remote:remote}
	
	//here we call setId on the client to finalise their connection to the game server
	remote.setId(conn.id);	
});

//detect client disconnection, remove their client from the clients list.
eurecaServer.onDisconnect(function (conn) {    
    console.log('Client disconnected ', conn.id);

	//remove the client from the list of clients
	var removeId = clients[conn.id].id;
	delete clients[conn.id];
	
	//tell all of the other clients that the client has disconnected
	for (var c in clients)
	{
		var remote = clients[c].remote;
		
		//Kill the player when they disconnect.
		remote.kill(conn.id);
	}	
});

//Handshaking between server and clients, to make sure that on connect the new client has the most up to date positions of the other clients.
eurecaServer.exports.handshake = function()
{
	for (var c in clients)
	{
		var remote = clients[c].remote;
		for (var cc in clients)
		{		
			//send latest known position
			var x = clients[cc].laststate ? clients[cc].laststate.x:  0;
			var y = clients[cc].laststate ? clients[cc].laststate.y:  0;

			//send the enemy information to all of the clients
			remote.spawnEnemy(clients[cc].id, x, y);		
		}
	}
}

//a server function that is called remotely from the clients, and is called whenever the client presses/releases a key, updates the position of the client on all other clients.
eurecaServer.exports.handleKeys = function (keys) {
	var conn = this.connection;
	var updatedClient = clients[conn.id];
	
	//loop through all of the clients
	for (var c in clients)
	{
		//get the next client
		var remote = clients[c].remote;

		//update the state of the clients
		remote.updateState(updatedClient.id, keys);
		
		//keep last known state so we can send it to new connected clients
		clients[c].laststate = keys;
	}
}

//Killing spree function!!
eurecaServer.exports.killingSpree = function(id)
{
	for (var c in clients)
	{
		var remote = clients[c].remote;
		
		//Dont need to tell myself im on a killingspree!!
		if (id != clients[c].id)
		{
			//Warn the other players someone is on a killing spree!!
			remote.killing();	
		};
	}
}

//Listening on port 8000
server.listen(8000);