/*global casinobot, sys, module, sendChanAll, SESSION*/
var RACE_CHANNEL = "Poke Race";
function Race(racechan) {
    var race = this;
    var state;
    var ticks;
    var border = "***************************************************************************************";
    
    var players;
    
    var racers;
    var underdog;
    var favorite;
    
    var phaseLength = 3;
    var joinPhase = 40;
    
    var goal = 30;
    var dice = {
        average: [1, 7],
        underdog: [1, 6],
        favorite: [2, 7]
    };
    var payouts = {
        average: [1.75, 1.1, 1, 1, 1, 1],
        underdog: [2, 1.25, 1.1, 1, 1, 1],
        favorite: [1.25, 1, 1, 1, 1, 1]
    };
    
    this.lastAdvertise = 0;
    
    this.startGame = function(src) {
        var name = sys.name(src);
        
        racers = {};
        players = {};
        underdog = null;
        favorite = null;
        
        var r;
        while (Object.keys(racers).length < 6) {
            r = sys.pokemon(sys.rand(1, 650));
            if (!(r in racers)) {
                racers[r] = 0;
            }
        }
        var names = Object.keys(racers);
        favorite = names[sys.rand(0, 3)];
        underdog = names[sys.rand(3, 6)];
        
        sys.sendAll("", racechan);
        sys.sendAll(border, racechan);
        casinobot.sendAll(name + " started a Pokemon Race game! Type /bet [pokemon]:[bet] to play (You have " + joinPhase + " seconds)! The racers are:", racechan);
        for (r in racers) {
            casinobot.sendAll(r + (r === favorite ? " (Favorite)" : "") +  (r === underdog ? " (Underdog)" : ""), racechan);
        }
        sys.sendAll(border, racechan);
        sys.sendAll("", racechan);
        
        players = {};
        
        state = "Entry";
        ticks = joinPhase;
        
        if (sys.playersOfChannel(racechan).length < 40) {
            var time = parseInt(sys.time(), 10);
            if (time > this.lastAdvertise + 60 * 15) {
                this.lastAdvertise = time;
                this.advertiseToChannel(0);
            }
        }
    };
    this.joinGame = function(src, commandData) {
        var name = sys.name(src);
        
        if (!casino.IsInCasino(src)) {
            casinobot.sendMessage(src, "You must first enter the casino! Type /entercasino for that!", racechan);
            return;
        }
        
        var data = commandData.split(":");
        if (data.length < 2) {
            casinobot.sendMessage(src, "Incorrect format! Type /bet [pokemon]:[bet] to play!", racechan);
            return;
        }
        
        var racer = data[0].toLowerCase();
        var bet = parseInt(data[1], 10);
        
        var list = Object.keys(racers).map(function(x) { return x.toLowerCase(); });
        if (list.indexOf(racer) === -1) {
            casinobot.sendMessage(src, "No such pokémon in the race!", racechan);
            return;
        }
        
        racer = sys.pokemon(sys.pokeNum(racer));
        
        if (isNaN(bet) || bet < 1) {
            casinobot.sendMessage(src, "Invalid bet! Please set a valid positive number!", racechan);
            return;
        }
        
        var changed = false;
        if (name in players) {
            changed = true;
        }
        
        if (bet < 10) {
            casinobot.sendMessage(src, "You must bet at least 10 Coins!", racechan);
            return;
        }
        if (bet > 1000) {
            casinobot.sendMessage(src, "You cannot bet more than 1000 Coins!", racechan);
            return;
        }
        
        if (SESSION.users(src).casino.coins < bet) {
            casinobot.sendMessage(src, "You don't have that many coins!", racechan);
            return;
        }
        
        players[name] = {
            racer: racer,
            bet: bet
        };
        
        if (changed) {
            casinobot.sendAll(name + " changed their bet to " + bet + " on " + racer + "!", racechan);
        } else {
            casinobot.sendAll(name + " bet " + bet + " on " + racer + "!", racechan);
        }
    };
    this.showContestants = function(src) {
        
        if (state === "Entry") {
            sys.sendMessage(src, "", racechan);
            casinobot.sendMessage(src, "A Pokemon Race is accepting bets now! Type /bet [pokemon]:[bet] to play (You have " + ticks + " seconds)! The racers are:", racechan);
            for (var r in racers) {
                casinobot.sendMessage(src, r + (r === favorite ? " (Favorite)" : "") +  (r === underdog ? " (Underdog)" : ""), racechan);
            }
            sys.sendMessage(src, "", racechan);
        } else if (state === "Running") {
            casinobot.sendMessage(src, "A game is running now! Wait for the next race to place bets!", racechan);
        } else if (state === "Blank") {
            casinobot.sendMessage(src, "No game is running! Type /start to begin a new race!", racechan);
        }
    };
    
    this.startRace = function() {
        state = "Running";
        for (var p in players) {
            if (SESSION.users(sys.id(p)).casino.coins < players[p].bet) {
                this.removePlayer(p);
                casinobot.sendAll(p + " was removed from the race for being too poor to bet!", racechan);
            } else {
                casino.addCoins(sys.id(p), -players[p].bet);
            }
        }
        
        if (Object.keys(players).length === 0) {
            this.endGame();
            sys.sendAll(border, racechan);
            casinobot.sendAll("No bets, no race!", racechan);
            sys.sendAll(border, racechan);
            
            return;
        }
        
        sys.sendAll("", racechan);
        this.nextPhase();
    };
    
    this.nextPhase = function() {
        var r, w;
        
        var type;
        for (r in racers) {
            type = "average";
            if (r === underdog) {
                type = "underdog";
            } else if (r === favorite) {
                type = "favorite";
            }
            w = sys.rand(dice[type][0], dice[type][1]);
            racers[r] += w;
            
            casinobot.sendAll(r + " advanced " + w + " spaces and is now at space " + racers[r] + "!", racechan);
        }
        sys.sendAll("", racechan);
        
        var winners = [], highest = goal;
        for (r in racers) {
            if (racers[r] >= highest) {
                if (racers[r] > highest) {
                    highest = racers[r];
                    winners = [];
                }
                winners.push(r);
            }
        }
        
        if (winners.length > 0) {
            sys.sendAll(border, racechan);
            casinobot.sendAll(readable(winners.map(function(x){ return x + (x === favorite ? " (Favorite)" : "") +  (x === underdog ? " (Underdog)" : ""); }), "and") + " won the race!", racechan);
            var pwinners = [];
            var player;
            for (r in players) {
                player = players[r];
                if (winners.indexOf(player.racer) !== -1) {
                    pwinners.push(r);
                }
            }
            
            if (pwinners.length > 0) {
                casinobot.sendAll(readable(pwinners, "and") + " won!", racechan);
                var prize, name, total;
                for (r in pwinners) {
                    name = pwinners[r];
                    player = players[name];
                    type = "average";
                    if (player.racer === underdog) {
                        type = "underdog";
                    } else if (player.racer === favorite) {
                        type = "favorite";
                    }
                    prize = Math.floor(players[name].bet * payouts[type][winners.length - 1]);
                    total = casino.addCoins(sys.id(name), prize);
                    casinobot.sendMessage(sys.id(name), "You received " + prize + " coins and now have " + total + "!", racechan);
                }
            } else {
                casinobot.sendAll("No one won!", racechan);
            }
            sys.sendAll(border, racechan);
            this.endGame();
        } else {
            ticks = phaseLength;
        }
    };
    
    this.endGame = function() {
        ticks = 0;
        state = "Blank";
    };
    this.unjoinGame = function(src) {
        var name = sys.name(src);
        if (isInGame(name)) {
            casinobot.sendAll(name + " left the game!", racechan);        
            this.removePlayer(name);
        } else {
            casinobot.sendMessage(src, "You didn't even join!", racechan);
        }
    };
    /* this.shovePlayer = function(src, name) {
        if (isInGame(name)) {
            cantJoinPlayers[name] = 1;
            casinobot.sendAll(sys.name(src) + " removed " + name + " from the game!", racechan);  
            this.removePlayer(name);
        } else {
            casinobot.sendMessage(src, "This person is not playing!", racechan);
        }
    }; */
    this.removePlayer = function(name) {
        delete players[name];
    };
    this.interruptGame = function(src) {
        var name = sys.name(src);
        if (getRaceAuth(src) > 0) {
            if (state !== "Blank") {
                sys.sendAll(border,racechan);
                casinobot.sendAll(name + " stopped the game!", racechan);
                sys.sendAll(border,racechan);
                this.endGame();
            } else {
                casinobot.sendMessage(src, "No game running!", racechan);
            }
        } else {
            casinobot.sendMessage(src, "You can't use this command!", racechan);
        }
    };
    this.advertiseToChannel = function(channel) {
        sendChanAll("", channel);
        sendChanAll(border, channel);
        sendChanAll("±Game: A new Pokemon Race game was started at #" + sys.channel(racechan) + "!", channel);
        sendChanAll(border, channel);
        sendChanAll("", channel);
    };

    function isInGame(name) {
        return name in players;
    }
    function getRaceAuth(src) {
        var name = sys.name(src).toLowerCase();
        if (SESSION.channels(racechan).masters.indexOf(name) !== -1) {
            return 3;
        } else if (SESSION.channels(racechan).admins.indexOf(name) !== -1 || sys.auth(src) >= 1) {
            return 2;
        } else if (SESSION.channels(racechan).operators.indexOf(name) !== -1) {
            return 1;
        }
        return 0;
	}
    
    this.showCommands = function(src) {
        var out = [
            "",
            "/start: To start a new race.",
            "/bet [pokemon]:[bet]: To place or change a bet and join the current race.",
            "/unjoin: To leave a game."
        ];
        
        var auth = getRaceAuth(src);
        if (auth > 0) {
            out.push("/end: To stop a game.");
            if (auth > 1) {
                out.push("/shove: To remove a player from a game.");
            }
        }
        out.push("");
        
        for (var x in out) {
            sys.sendMessage(src, out[x], racechan);
        }
    };
    this.init = function() {
		if (sys.existChannel(RACE_CHANNEL)) {
            racechan = sys.channelId(RACE_CHANNEL);
        } else {
            racechan = sys.createChannel(RACE_CHANNEL);
        }
        
        state = "Blank";
    };
    this.stepEvent = function() {
        race.tickDown();
	};
    this.tickDown = function() {
        if (ticks > 0) {
            ticks--;
            if (ticks <= 0) {
                if (state === "Entry") {
                    this.startRace();
                } else if (state === "Running") {
                    this.nextPhase();
                } 
            }
        }
    };
    this.afterChannelJoin = function(src, channel) {
        if (channel == racechan) {
            race.showContestants(src);
        }
        return false;
    };
    this.handleCommand = function(src, message, channel) {
        var command;
		var commandData = '*';
		var pos = message.indexOf(' ');
		if (pos !== -1) {
			command = message.substring(0, pos).toLowerCase();
			commandData = message.substr(pos+1);
		} else {
			command = message.substr(0).toLowerCase();
		}
        
        if (channel !== racechan) {
            return;
        }
        try {
			race.handleStopCommand(src, command, commandData, channel);
            return true;
        } catch(e) {
            if (e !== "No valid command") {
                sys.sendAll("Error on Race command" + (e.lineNumber ? " on line " + e.lineNumber : "") + ": " + e, racechan);
                if (sys.id("RiceKirby") !== undefined) {
                    sys.sendMessage(sys.id("RiceKirby"), "Error on Race command" + (e.lineNumber ? " on line " + e.lineNumber : "") + ": " + e + " [" + sys.name(src) + " typed /" + message + "]", racechan);
                }
                return true;
            }
        }
    };
    this.handleStopCommand = function(src, command, data, chan) {
        var name = sys.name(src);
        
        if (command === "start") {
            if (state === "Blank") {
                this.startGame(src);
            } else {
                casinobot.sendMessage(src, "You can't start a new game now! Wait for the current game to end!", racechan);
            }
            return true;
        } else if (command === "bet") {
            if (state === "Entry") {
                /* if (name in cantJoinPlayers) {
                    casinobot.sendMessage(src, "You can't join this round!", racechan);
                    return true;
                } */
                this.joinGame(src, data);
            } else {
                casinobot.sendMessage(src, "You can't bet now! Wait for the next game to place bets!", racechan);
            }
            return true;
        } else if (command === "unjoin") {
            this.unjoinGame(src);
            return true;
        } else if (command === "end") {
            this.interruptGame(src);
            return true;
        } else if (command === "commands") {
            this.showCommands(src);
            return true;
        } else if (command === "shove" && getRaceAuth(src) === 2) {
            // this.shovePlayer(src, data);
            return true;
        }
        
        throw("No valid command");
    };
    
    function readable(arr, last_delim) {
        if (!Array.isArray(arr)) {
            return arr;
        }
        if (arr.length > 1) {
            return arr.slice(0, arr.length - 1).join(", ") + " " + last_delim + " " + arr.slice(-1)[0];
        } else if (arr.length === 1) {
            return arr[0];
        } else {
            return "";
        }
    }
}

module.exports = function() {
    var id;
    var init = function() {
        if (sys.existChannel(RACE_CHANNEL)) {
            id = sys.channelId(RACE_CHANNEL);
        } else {
            id = sys.createChannel(RACE_CHANNEL);
        }
    };

    var game = new Race(id);

    return {
        game: game,
        init: game.init,
        handleCommand: game.handleCommand,
        afterChannelJoin: game.afterChannelJoin,
        stepEvent: game.stepEvent
    };
}();
