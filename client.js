var myId = 0;			//player ID
var ready = false;		//Are we ready to update the game?
var eurecaServer;		//Instance of the eureca server

var cursors;			//input!!

var shipList;			//A list of all the ships to send to the server

//sprites
var ship; 				//the player's ship
var bg;					//background
var player;				//the player's sprite
var blaster;			//sound object for when the player shoots
var killingSpree;		//sound object for when the player's on a killing spree
var enemyKS;			//another killing spree sound

//Bullet handling
var bullets;			//bullet variables
var fireRate;			//The rate of fire for the player
var nextFire;			//Used to regulate the fire rate

//Re spawn variables
var spawnRate;
var nextSpawn;

//variable to hold local players score
var score = 0;

//handles communication with the server.
var eurecaClientSetup = function() {
	//create an instance of eureca.io client
	var eurecaClient = new Eureca.Client();
	
	eurecaClient.ready(function (proxy) {		
		eurecaServer = proxy;
	});
	
	
	//methods defined under "exports" namespace become available in the server side
	
	eurecaClient.exports.setId = function(id) 
	{
		//set the client's id
		myId = id;
		//create the clients game
		create();
		//server-client handshaking
		eurecaServer.handshake();
		//Client is ready to play
		ready = true;
	}	
	
	//Used to kill ships that have disconnected
	eurecaClient.exports.kill = function(id)
	{	
		if (shipList[id]) {
			shipList[id].kill();
		}
	}	
	
	//Spawns your opponents onto screen.
	eurecaClient.exports.spawnEnemy = function(i, x, y)
	{
		//if the id is mine, don't re spawn me!!
		if (i == myId) return; //this is me

		//making a temporary ship to spawn.
		var shp = new Ship(i, game, ship);
		shipList[i] = shp;
	}
	
	//updating the ships
	eurecaClient.exports.updateState = function(id, state)
	{
		if (shipList[id])  {
			shipList[id].cursor = state;
			shipList[id].ship.x = state.x;
			shipList[id].ship.y = state.y;
			shipList[id].ship.angle = state.angle;
			shipList[id].update();
		}
	}
	
	//get the clients to play the enemy killing spree sound
	eurecaClient.exports.killing = function()
	{
		enemyKS.play();	
	}
}

//Creating the player's ship.
Ship = function (index, game, player) {
	//Setting up the input handler
	this.cursor = {
		left:false,
		right:false,
		up:false,
		down:false,
		fire:false		
	}

	this.input = {
		left:false,
		right:false,
		up:false,
		down:false,
		fire:false
	}

	//position variables
	var x = 0; var y = 0;

	//parsing the game and player variables
    this.game = game;
    this.player = player;	

    //Creating the bullets and giving them some properties
    this.bullets = game.add.group();
    this.bullets.enableBody = true;
    this.bullets.physicsBodyType = Phaser.Physics.ARCADE;
    this.bullets.createMultiple(20, 'bullet', 0, false);
    this.bullets.setAll('anchor.x', 0.5);
    this.bullets.setAll('anchor.y', 0.5);
    this.bullets.setAll('outOfBoundsKill', true);
    this.bullets.setAll('checkWorldBounds', true);
	
	//player's game play variables
    this.currentSpeed = 0;
    this.fireRate = 500;
    this.nextFire = 0;
    this.kills = 0;
	this.killingSpree = 0;
    this.deaths = 0;

    //Are you alive?
    this.alive = true;
    this.spawnRate = 2500;
    this.nextSpawn = 0;

    //Adding the sprite and anchoring
    this.ship = game.add.sprite(x, y, 'ship');
    this.ship.anchor.set(0.5);

    //What way the ship is facing
    this.ship.angle = -90;

    //Some additional physics
    this.ship.id = index;
    game.physics.enable(this.ship, Phaser.Physics.ARCADE);
    this.ship.body.immovable = false;
    this.ship.body.collideWorldBounds = true;
    this.ship.body.bounce.setTo(0, 0);

    //Positioning the player
    game.physics.arcade.velocityFromRotation(this.ship.rotation, 0, this.ship.body.velocity);
}

//Ship update function
Ship.prototype.update = function() {

	//Check to see if the player has pressed a key
	var inputChanged = (
		this.cursor.left != this.input.left ||
		this.cursor.right != this.input.right ||
		this.cursor.up != this.input.up ||
		this.cursor.down != this.input.down ||
		this.cursor.fire != this.input.fire
	);
	
	//If they have 
	if (inputChanged)
	{
		//Handle input change here
		//send new values to the server		
		if (this.ship.id == myId)
		{
			// send latest valid state to the server
			this.input.x = this.ship.x;
			this.input.y = this.ship.y;
			this.input.angle = this.ship.angle;
			
			//Send the input to the server.
			eurecaServer.handleKeys(this.input);
		}
	}

	//Rotating the ship
	if (this.cursor.left)
    {
        this.ship.angle -= 2.5;
    }
    else if (this.cursor.right)
    {
        this.ship.angle += 2.5;
    }

    //up key increases speed
    if (this.cursor.up)
    {
    	if (this.currentSpeed < 450)
    	{
    		this.currentSpeed += 10;
    	}
    }

    //down key reduces speed
    if (this.cursor.down)
    {
    	if (this.currentSpeed > 0)
    	{
    	   	this.currentSpeed -= 5;
    	}
    }

    //Shooting pew pew
    if(this.cursor.fire)
    {
    	if(this.alive){
    		this.fire({x:this.ship.x, y:this.ship.y});
    	}
    }

    //Some phaser physics to move the ship
    if (this.currentSpeed > 0)
    {
        game.physics.arcade.velocityFromRotation(this.ship.rotation, this.currentSpeed, this.ship.body.velocity);
    }	
	else
	{
		game.physics.arcade.velocityFromRotation(this.ship.rotation, 0, this.ship.body.velocity);
	}
}

//Ship fire function
Ship.prototype.fire = function() {
	//If the player is able to shoot.
    if (this.game.time.now > this.nextFire && this.bullets.countDead() > 0)
    {
    	//resetting the shot speed
        this.nextFire = this.game.time.now + this.fireRate;
        //creating the bullet.
        var bullet = this.bullets.getFirstDead();
        //resetting the position of the bullet to that of the ships
        bullet.reset(this.ship.x, this.ship.y);
		//play blaster sound
		blaster.play();

        //Angle the bullet so it fires in the direction of the ship
		this.game.physics.arcade.velocityFromAngle(this.ship.angle, 500 + this.currentSpeed, bullet.body.velocity);
    }
}

//Ship kill function
Ship.prototype.kill = function() {
	this.alive = false;
	this.ship.kill();
}

/*//Ship re spawn function
Ship.prototype.respawn = function() {
	this.alive = true;
    this.ship = game.add.sprite(x, y, 'ship');
    this.ship.anchor.set(0.5);
}*/

//Using phaser to create the game
var game = new Phaser.Game(800,600, Phaser.AUTO, 'Spacebattles!', {preload: preload, create: eurecaClientSetup, update: update, render: render });

//preloading the game (for assets etc...)
function preload () {

	//load in our background sprite 
	game.load.image('background', 'assets/bg2.jpg');
	//load in our player sprite
	game.load.image('ship', 'assets/player.png');
	//load in our bullet sprite
	game.load.image('bullet', 'assets/bullet.png');
	//load the blaster sound
	game.load.audio('blaster', 'assets/blaster.mp3');
	//load the killing spree sound
	game.load.audio('killingSpree', 'assets/killingspree.mp3');
	//loading the enemy killing spree sound
	game.load.audio('enemyKS', 'assets/enemyKS.mp3');
	//loading a text font
	game.load.bitmapFont('desyrel', 'assets/fonts/bitmapFonts/desyrel.png', 'assets/fonts/bitmapFonts/desyrel.xml');
}

//Building the game.
function create () {

    //Resize the game world to be 2000x2000
    game.world.setBounds(-1000, -1000, 2000, 2000);
	game.stage.disableVisibilityChange = true;

    //The scrolling background
    bg = game.add.tileSprite(0, 0, 800, 600, 'background');
    bg.fixedToCamera = true;
	
	//Creating the array of ships
	shipList = {};

	//adding the text
	text = game.add.text(-100, -100, "", {  
	font: "65px Arial",
        fill: "#ffffff",
        align: "left"
    });
	//text.fixedToCamera = true;
	
	//add the audio to the blaster object, makes sound management easier
	blaster = game.add.audio('blaster');
	//adding the killing spree sound
	killingSpree = game.add.audio('killingSpree');
	//adding the enemy killing spree audio
	enemyKS = game.add.audio('enemyKS');
	
	//Creating and instance of the player
	player = new Ship(myId, game, ship);
	shipList[myId] = player;
	ship = player.ship;
	ship.x = 0;
	ship.y = 0;
	bullets = player.bullets;

	//bringing the ship to the top of the screen
	ship.bringToTop();

	//getting the camera to follow the player
	game.camera.follow(ship);
	game.camera.deadzone = new Phaser.Rectangle(150, 150, 500, 300);
    game.camera.focusOnXY(0, 0);

    //setting up the input handler
    cursors = game.input.keyboard.createCursorKeys();
}

function update () {

	//if the game isn't ready(the player hasn't connected yet)
	if (!ready) return;

	//Changes the player's input variables to equal player input
	player.input.left  = cursors.left.isDown;
	player.input.right = cursors.right.isDown;
	player.input.up    = cursors.up.isDown;
	player.input.down  = cursors.down.isDown;
	player.input.fire  = game.input.keyboard.addKey(Phaser.Keyboard.SPACEBAR).isDown;

	//Moving the background
    bg.tilePosition.x = -game.camera.x;
    bg.tilePosition.y = -game.camera.y;
	
    //update all of the ships
    for (var i in shipList)
    {
		if (!shipList[i]) continue;
		//temporary variables to hold the bullets and current ship
		var currentBullets = shipList[i].bullets;
		var currentShip = shipList[i].ship;
		for (var j in shipList)
		{
			if (!shipList[j]) continue;
			//if the current ship isn't yours
			if (j!=i) 
			{
				var targetShip = shipList[j].ship;
				//checking for collisions between i ship's bullets vs j ship
				if(game.physics.arcade.overlap(currentBullets, targetShip, killBullet, null, this))
				{
					//update the killer's score!
					shipList[myId].kills += 1;
					shipList[myId].killingSpree += 1;
					if(shipList[myId].killingSpree >= 3)
					{
						killingSpree.play();
						//eurecaServer.killingSpree(myId);
					}
					
					//update the dead player's score
					shipList[j].currentSpeed = 0;
					shipList[j].deaths += 1;
					shipList[j].killingSpree = 0;
					
					//update the local score, as well as the server score
					score = shipList[myId].killingSpree;
				}
			}
			if (shipList[j].alive)
			{
				//if the ship is alive update its position
				shipList[j].update();
			}
		}	
    }
}

function killBullet(ship, bullet){
	//kill the bullet sprite
	bullet.kill();
	//"Respawn the ship
	ship.x = Math.floor((Math.random() * 3000) - 1500); 
	ship.y = Math.floor((Math.random() * 3000) - 1500);
}

function render () {
	//displays the players score above all the other sprites in the game, and updates it whenever they get a new kill, this utilises the debug text, which is a bit hacky, but its certainly easier than working with the text object, fixing it to the camera, and off setting the text into the corner, then displaying the text above all other sprites.
	game.debug.text('Your Killing Spree: ' + score, 32, 32);
	//Some debug information
	//game.debug.cameraInfo(game.camera, 32, 32);
}
