/*jshint "laxbreak":true,"shadow":true,"undef":true,"evil":true,"trailing":true,"proto":true,"withstmt":true*/
/*global sys:true, sendChanHtmlAll:true, module:true, SESSION:true, casinochan, casinobot, script */
module.exports = function () {
    var casino = this;
    var casinochan;

    var defaultMaster = "Beast";
    var defaultChannel = "Beasts Workshop";
  
  this.coins = 0;
	var payout;
	var caldice;
	var crapsdice;
	var calnumber;
	var crapsnumber;
	var bet;
	var myCoins;
	var dice1;
	var dice2;
	var dice3;
	var slot;
	var jackpot = 1000;
	
	
	this.playCAL = function(src, commandData){
		if(commandData === undefined){
			return;
		}
		if (!isNonNegative(SESSION.users(src).coins)) {
            SESSION.users(src).coins = 100;
		}
		bet = commandData.split(":")[0];
        calnumber = commandData.split(":")[1];
        if(SESSION.users(src).coins < bet){
			casinobot.sendMessage(src, "You don't have enough coins to make that bet.", casinochan);
			return;
        }
        if(calnumber >= 19){
			casinobot.sendMessage(src, "That is not a result that 3 dice can make", casinochan);
			return;
        }

        dice1 = Math.floor((Math.random()*6)+1);
        dice2 = Math.floor((Math.random()*6)+1);
        dice3 = Math.floor((Math.random()*6)+1);
        coins[sys.name(src)] -= bet;
        caldice = dice1 + dice2 + dice3;
        if(caldice == calnumber){
            if(calnumber == 3 || calnumber == 18){
                payout = bet*8;
            }
            else if(calnumber == 4 || calnumber == 17){
                payout = bet*7;
            }
            else if(calnumber == 5 || calnumber == 16){
                payout = bet*6;
            }
            else if(calnumber == 6 || calnumber == 15){
                payout = bet*5;
            }
            else if(calnumber == 7 || calnumber == 14){
                payout = bet*4;
            }
            else if(calnumber == 8 || calnumber == 13){
                payout = bet*3;
            }
            else if(calnumber == 9 || calnumber == 12){
                payout = bet*2;
            }
            else if(calnumber == 10 || calnumber == 11){
                payout = bet*1;
            }
            casinobot.sendMessage(src, "You rolled a " +caldice+" and matched your number!! You get " + payout+ " coins!", casinochan);
            SESSION.users(src).coins += payout;
          if(payout >= 500){
                casinobot.sendAll(sys.name(src) + "just got a huge payout of " +payout+ " coins!!!!");
          }
            caldice = undefined;
            dice1 = undefined;
            dice2 = undefined;
            dice3 = undefined;
            crapsnumber = undefined;
            bet = undefined;
            return;
            }
        else{
            casinobot.sendMessage(src, "Sorry you rolled a " +caldice+".  You lost " +bet+ " coins!", casinochan);
            caldice = undefined;
            dice1 = undefined;
            dice2 = undefined;
            dice3 = undefined;
            return;
        }
        if(coins[sys.name(src)] <= 0 || coins[sys.name(src)] == undefined){
            coins[sys.name(src)] == 100;
        }
	};
this.playCraps = function (src, commandData){
		if(commandData === undefined){
			return;
		}
		if (!isNonNegative(SESSION.users(src).coins)) {
            SESSION.users(src).coins = 100;
		}
		if(SESSION.users(src).coins <= 0){
			casinobot.sendMessage(src, "You don't have any coins so you are not able to play.", casinochan);
			return;
		}
		bet = commandData;
        if(coins[sys.name(src)] < bet){
			casinobot.sendMessage(src, "You don't have enough coins to make that bet.", casinochan);
			return;
        }
        if(calnumber >= 13){
			casinobot.sendMessage(src, "That is not a result that 3 dice can make", casinochan);
			return;
        }
		dice1 = Math.floor((Math.random()*6)+1);
		dice2 = Math.floor((Math.random()*6)+1);
		coins[sys.name(src)] -= bet;
	crapsdice = dice1 + dice2;
		if(crapsdice === 7 || crapsdice === 11){
			payout = bet*5;
			casinobot.sendMessage(src, "You rolled a " +crapsdice+ " and got " +payout+ " coins!", casinochan);
			SESSION.users(src).coins += payout;
          if(payout >= 500){
			casinobot.sendAll(sys.name(src) + "just got a huge payout of " +payout+ " coins!!!!", casinochan);
			return;
          }
		}
		else if(crapsdice === 4 || crapsdice === 5 || crapsdice === 6 || crapsdice === 8 || crapsdice === 9 || crapsdice === 10){
			payout = bet*2;
			casinobot.sendMessage(src, "You rolled a " +crapsdice+ " and got " +payout+ " coins!", casinochan);
			SESSION.users(src).coins += payout;
			return;
		}
		else{
			casinobot.sendMessage(src, "You rolled a " +crapsdice+ " and lost " +bet+ " coins!", casinochan);
			SESSION.users(src).coins -= bet;
			return;
		}
		dice1 = undefined;
		dice2 = undefined;
		crapsdice = undefined;
		if(coins[sys.name(src)] <= 0 || coins[sys.name(src)] == undefined){
			coins[sys.name(src)] == 100;
		}
		};
	this.playSlots = function (src){
		if (!isNonNegative(SESSION.users(src).coins)) {
            SESSION.users(src).coins = 100;
		}
		if(SESSION.users(src).coins <= 0){
			casinobot.sendMessage(src, "You don't have any coins so you are not able to play.", casinochan);
			return;
		}
		coins[sys.name(src)] -= 1;
		slot = Math.floor((Math.random()*300)+1);
		if(slot == 1){
			SESSION.users(src).coins += jackpot;
			casinobot.sendMessage(src, "You hit the jackpot!!!  You got " +jackpot+ " coins!", casinochan);
			casinobot.sendAll(sys.name(src) + " just hit the jackpot and got " +jackpot+ " coins!!!!!");
			slot = undefined;
			jackpot = 1000;
			return;
		}
		if(slot <= 8){
			SESSION.users(src).coins += 32;
			casinobot.sendMessage(src, "You hit a great number and got 32 coins!!!", casinochan);
			jackpot += 1;
			return;
		}
		if(slot <= 18){
			SESSION.users(src).coins += 16;
			casinobot.sendMessage(src, "You hit a good number and got 16 coins!!", casinochan);
			jackpot += 1;
			return;
		}
		if(slot <= 35){
			SESSION.users(src).coins += 8;
			casinobot.sendMessage(src, "You hit an okay number and got 8 coins!", casinochan);
			jackpot += 1;
			return;
		}
		if(slot <= 75){
			SESSION.users(src).coins += 4;
			casinobot.sendMessage(src, "Your got lucky and won 4 coins.", casinochan);
			jackpot += 1;
			return;
		}
		if(slot <= 125){
			SESSION.users(src).coins += 2;
			casinobot.sendMessage(src, "You got 2 coins.  It is better than nothing.", casinochan);
			jackpot += 1;
			return;
		}
		else {
			casinobot.sendMessage(src, "Your luck wasn't good enough for you to win. Better luck next time.", casinochan);
			jackpot +=1;
			return;
		}
		slot = undefined;
	};
	this.playNSlots = function (src) {
        var slot;
		if (!isNonNegative(SESSION.users(src).coins)) {
            SESSION.users(src).coins = 100;
		}
		SESSION.users(src).coins -= 5;
		slot = Math.floor((Math.random() * 300) + 1);
		if (slot === 1) {
			SESSION.users(src).coins += jackpot;
			casinobot.sendMessage(src, "You hit the jackpot!!!  You got " + jackpot + " coins!", casinochan);
			casinobot.sendAll(sys.name(src) + " just hit the jackpot and got " + jackpot + " coins in #Casino!!!!!", 0);
			jackpot = 1000;
			return;
		}
		if (slot <= 5) {
			SESSION.users(src).coins += 80;
			casinobot.sendMessage(src, "You hit a great number and got 80 coins!!!", casinochan);
			jackpot += 1;
			return;
		}
		if (slot <= 14) {
			SESSION.users(src).coins += 40;
			casinobot.sendMessage(src, "You hit a good number and got 40 coins!!", casinochan);
			jackpot += 1;
			return;
		}
		if (slot <= 30) {
			SESSION.users(src).coins += 20;
			casinobot.sendMessage(src, "You hit an okay number and got 20 coins!", casinochan);
			jackpot += 1;
			return;
		}
		if (slot <= 53) {
			SESSION.users(src).coins += 10;
			casinobot.sendMessage(src, "Your got lucky and won 10 coins.", casinochan);
			jackpot += 1;
			return;
		}
		if (slot <= 85) {
			SESSION.users(src).coins += 5;
			casinobot.sendMessage(src, "You got 5 coins.  It is better than nothing.", casinochan);
			jackpot += 1;
			return;
		} else {
			casinobot.sendMessage(src, "Your luck wasn't good enough for you to win. Better luck next time.", casinochan);
			jackpot += 1;
			return;
		}
	};
		this.playQSlots = function (src) {
        var slot;
		if (!isNonNegative(SESSION.users(src).coins)) {
            SESSION.users(src).coins = 100;
		}
		SESSION.users(src).coins -= 25;
		slot = Math.floor((Math.random() * 300) + 1);
		if (slot === 1) {
			SESSION.users(src).coins += jackpot;
			casinobot.sendMessage(src, "You hit the jackpot!!!  You got " + jackpot + " coins!", casinochan);
			casinobot.sendAll(sys.name(src) + " just hit the jackpot and got " + jackpot + " coins in #Casino!!!!!", 0);
			jackpot = 1000;
			return;
		}
		if (slot <= 5) {
			SESSION.users(src).coins += 400;
			casinobot.sendMessage(src, "You hit a great number and got 400 coins!!!", casinochan);
			jackpot += 1;
			return;
		}
		if (slot <= 14) {
			SESSION.users(src).coins += 200;
			casinobot.sendMessage(src, "You hit a good number and got 200 coins!!", casinochan);
			jackpot += 1;
			return;
		}
		if (slot <= 30) {
			SESSION.users(src).coins += 100;
			casinobot.sendMessage(src, "You hit an okay number and got 100 coins!", casinochan);
			jackpot += 1;
			return;
		}
		if (slot <= 53) {
			SESSION.users(src).coins += 50;
			casinobot.sendMessage(src, "Your got lucky and won 50 coins.", casinochan);
			jackpot += 1;
			return;
		}
		if (slot <= 85) {
			SESSION.users(src).coins += 25;
			casinobot.sendMessage(src, "You got 25 coins.  It is better than nothing.", casinochan);
			jackpot += 1;
			return;
		} else {
			casinobot.sendMessage(src, "Your luck wasn't good enough for you to win. Better luck next time.", casinochan);
			jackpot += 1;
			return;
		}
	};
		this.playDSlots = function (src) {
        var slot;
		if (!isNonNegative(SESSION.users(src).coins)) {
            SESSION.users(src).coins = 0;
		}
		SESSION.users(src).coins -= 100;
		slot = Math.floor((Math.random() * 300) + 1);
		if (slot === 1) {
			SESSION.users(src).coins += jackpot;
			casinobot.sendMessage(src, "You hit the jackpot!!!  You got " + jackpot + " coins!", casinochan);
			casinobot.sendAll(sys.name(src) + " just hit the jackpot and got " + jackpot + " coins in #Casino!!!!!", 0);
			jackpot = 1000;
			return;
		}
		if (slot <= 5) {
			SESSION.users(src).coins += 1600;
			casinobot.sendMessage(src, "You hit a great number and got 1600 coins!!!", casinochan);
			jackpot += 1;
			return;
		}
		if (slot <= 14) {
			SESSION.users(src).coins += 800;
			casinobot.sendMessage(src, "You hit a good number and got 800 coins!!", casinochan);
			jackpot += 1;
			return;
		}
		if (slot <= 30) {
			SESSION.users(src).coins += 400;
			casinobot.sendMessage(src, "You hit an okay number and got 400 coins!", casinochan);
			jackpot += 1;
			return;
		}
		if (slot <= 53) {
			SESSION.users(src).coins += 200;
			casinobot.sendMessage(src, "Your got lucky and won 200 coins.", casinochan);
			jackpot += 1;
			return;
		}
		if (slot <= 85) {
			SESSION.users(src).coins += 100;
			casinobot.sendMessage(src, "You got 100 coins.  It is better than nothing.", casinochan);
			jackpot += 1;
			return;
		} else {
			casinobot.sendMessage(src, "Your luck wasn't good enough for you to win. Better luck next time.", casinochan);
			jackpot += 1;
			return;
		}
	};
this.showGames = function (){
	var games = [
		"+Dealer: Chuck-a-luck - Choose any number that 3 dice can make.  If the dice come up with your number you win.",
		"+Dealer: Craps - Roll the dice if you get 7 or 11 get 5 times your bet. Role a 4,5,6,8,9,10 and get double your bet. Role 2 or 12 and you lose.",
		"+Dealer: Slots - Press your luck with this game.  You better hope your lucky number comes up."
    ];
    for (var i in games) {
        casinobot.sendMessage(src, games[i], casinochan);
    }
};
this.showmyCoins = function (src){
	myCoins = SESSION.users(src).coins;
	casinobot.sendMessage(src, "You have " +myCoins+ " coins right now.");
	return;
};
this.showHelp = function (commandData){
	if(commandData == "chuck" || commandData == "cal" || commandData == "chuck a luck"){
		casinobot.sendMessage(src, "To play type /sAL bet:number. bet is how many coins you are risking and number is the number you are trying to roll.", casinochan);
		return;
	}
	else if(commandData == "craps"){
		casinobot.sendMessage(src, "To play type /sraps bet.  bet is how many coins you are risking.");
		return;
	}
    else if(commandData == "slots"){
        casinobot.sendMessage(src, "To play type /slots. You winning depend on how lucky you are.");
        return;
	}
	else{
        
		var help = [
		"",
		"Type /help CAL or /help Chuck a Luck to learn how to play Chuck a Luck.",
		"Type /help Craps to learn how to play Craps.",
		""
		];
        for (var i in help) {
		sys.sendMessage(src, help[i]);
        }
		return;
	}
};
    this.showBCommands = function () {
		var some = [
		"Commands:",
		"/cal bet:number  To Play Chuck A Luck.",
		"/craps bet  To play Craps",
		"/help To learn how to play the games.",
		"/games To see all the games you are able to play.",
		"/slots to play penny slots.",
		"/nslots to play nickel slots.",
		"/qslots to play quarter slots.",
		"/dslots to play dollar slots.",
		"/mycoins To find out how many coins you have."
		];
        
        for (var i in some) {
            try {
                casinobot.sendMessage(src, some[i], casinochan);
            } catch (err) {
                kickbot.sendAll("Error: " + err);
            }
        }
	};		
 this.casinocommands = {
        user: {
            cal: [this.playCAL, "To play Chuck A Luck. Used like /cal bet:number"],
            craps: [this.playCraps, "To play Craps. Used like /craps bet"],
	    slots: [this.playSlots, "To play the Penny slots. Used like /slots"],
            help: [this.showHelp, "To learn how to play the games."],
            games: [this.showGames, "To see all the games you can play."],
            mycoins: [this.showmyCoins, "To find out how many coins you have."],
	    bcasinocommands: [this.showBCommands, "To see a list of possible commands."],
		nslots: [this.playNSlots, "To play the Nickle slots. Used like /nslots"],
		qslots: [this.playQSlots, "To play the Quarter slots. Used like /qslots"],
		dslots: [this.playDSlots, "To play the Dollar slots. Used like /dslots"]
        }
	};
this.handleCommand = function (src, message, channel) {
        var command;
        var commandData;
        var pos = message.indexOf(' ');
        if (pos !== -1) {
            command = message.substring(0, pos).toLowerCase();
            commandData = message.substr(pos + 1);
        }
		else {
            command = message.substr(0).toLowerCase();
        }
        if (channel !== casinochan) {
            return;
        }
        if (command in casino.casinocommands.user) { //Ricetip: You will need this block to make commands work.
            casino.casinocommands.user[command][0].call(casino, src, commandData);
            return true;
        }
        
	};
    this.init = function () {
        var name = defaultChannel;
        if (sys.existChannel(name)) {
            casinochan = sys.channelId(name);
        } else {
            casinochan = sys.createChannel(name);
        }
        SESSION.global().channelManager.restoreSettings(casinochan);
        SESSION.channels(casinochan).perm = true;
        SESSION.channels(casinochan).master = defaultMaster;
    };
    this.beforeChannelJoin = function (src, channel) {
        if (channel !== casinochan) {
            return false;
        }
        return false;
    };
    return { //Ricetip: You will probably need this. You can add/renive other events here, just make sure the methods exist!
        init: casino.init,
        handleCommand: casino.handleCommand,
        beforeChannelJoin: casino.beforeChannelJoin
    };
}();
