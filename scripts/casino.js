/*jslint es5: true, evil: true, plusplus: true, sloppy: true, vars: true, eqeq: true*/
/*jshint "laxbreak":true,"shadow":true,"undef":true,"evil":true,"trailing":true,"proto":true,"withstmt":true*/
/*global sys:true, sendChanHtmlAll:true, module:true, SESSION:true, casinobot, script, require, bot, staffchannel, sendChanMessage */
module.exports = (new function () {
    var casino = this,
        casinochan,
        casinoCommandCooldown = 2, // in seconds. only applies to cal, craps, and slots.
        defaultMaster = "BeastCharizard",
        defaultChannel = "Casino";
  
    var utilities = require('utilities.js'),
        Poker = require('poker.js'),
        //MemoryHash = require('memoryhash.js'),
        isNonNegative = utilities.is_non_negative;
    
	var jackpot = 1000,
        stepTimer = 0,
        cooldowns = {},
        global = SESSION.global();
    
    //this.memoryHash = new MemoryHash('casino-data.json');
    //if (!global.coins) {
        global.coins = {};//JSON.parse((casino.memoryHash.get('coins') || "{}"));
    //}
    this.chan = undefined;
    
    try {
        this.poker = new Poker(casino);
    } catch (e) {
        if (staffchannel) {
            bot.sendAll("Couldn't load poker: " + e + " on line " + e.lineNumber + " [" + Object.keys((Poker || {})) + "]", staffchannel);
        }
        
        this.poker = {handleCommand: function () {}, step: function () {}};
    }
    
	this.playCAL = function (src, commandData) {
        var bet,
            calnumber,
            dice1,
            dice2,
            dice3,
            caldice,
            payout;
        
        if (global.coins[sys.name(src).toLowerCase()] === undefined) {
	        global.coins[sys.name(src).toLowerCase()] = 100;
        }
        
        if (isNaN(global.coins[sys.name(src).toLowerCase()])) {
            global.coins[sys.name(src).toLowerCase()] = 1;
        }
		if (commandData === undefined) {
			return;
		}
		if (global.coins[sys.name(src).toLowerCase()] <= 0) {
			casinobot.sendMessage(src, "You don't have any coins so you are not able to play.", casinochan);
			return;
		}
		bet = parseInt(commandData.split(":")[0], 10);
        calnumber = parseInt(commandData.split(":")[1], 10);
        if (isNaN(bet) || isNaN(calnumber)) {
            casinobot.sendMessage(src, "You use it like /cal [number you are betting]:[number you want to get].", casinochan);
            return;
        }
        if (global.coins[sys.name(src).toLowerCase()] < bet) {
            casinobot.sendMessage(src, "You don't have enough coins to make that bet.", casinochan);
			return;
        }
        if (bet > 100) {
            casinobot.sendMessage(src, "The max bet is 100 coins.", casinochan);
            return;
        }
        if (bet < 1) {
            casinobot.sendMessage(src, "The minimum bet is 1 coin.", casinochan);
        }
        if (calnumber >= 19) {
			casinobot.sendMessage(src, "That is not a result that 3 dice can make", casinochan);
			return;
        }

        dice1 = Math.floor((Math.random() * 6) + 1);
        dice2 = Math.floor((Math.random() * 6) + 1);
        dice3 = Math.floor((Math.random() * 6) + 1);
        global.coins[sys.name(src).toLowerCase()] -= bet;
        caldice = dice1 + dice2 + dice3;
        if (caldice == calnumber) {
            if (calnumber == 3 || calnumber == 18) {
                payout = bet * 8;
            }
            if (calnumber == 4 || calnumber == 17) {
                payout = bet * 7;
            }
            if (calnumber == 5 || calnumber == 16) {
                payout = bet * 6;
            }
            if (calnumber == 6 || calnumber == 15) {
                payout = bet * 5;
            }
            if (calnumber == 7 || calnumber == 14) {
                payout = bet * 4;
            }
            if (calnumber == 8 || calnumber == 13) {
                payout = bet * 3;
            }
            if (calnumber == 9 || calnumber == 12) {
                payout = bet * 2;
            }
            if (calnumber == 10 || calnumber == 11) {
                payout = bet;
            }
            
            casinobot.sendMessage(src, "You rolled a " + caldice + " and matched your number!! You get " + payout + " coins!", casinochan);
            global.coins[sys.name(src).toLowerCase()] += payout;
            if (payout >= 400) {
                casinobot.sendAll(sys.name(src) + " just got a huge payout of " + payout + " coins!!!!", casinochan);
            }
            return;
        } else {
            casinobot.sendMessage(src, "Sorry you rolled a " + caldice + ".  You lost " + bet + " coins!", casinochan);
            return;
        }
	};
    this.playCraps = function (src, commandData) {
        var bet,
            dice1,
            dice2,
            crapsdice,
            payout;
        
        if (!global.coins.hasOwnProperty(src)) {
            global.coins[sys.name(src).toLowerCase()] = 100;
        }
        
        if (isNaN(global.coins[sys.name(src).toLowerCase()])) {
            global.coins[sys.name(src).toLowerCase()] = 1;
        }
        if (commandData === undefined) {
            return;
        }
        if (global.coins[sys.name(src).toLowerCase()] <= 0) {
            casinobot.sendMessage(src, "You don't have any coins so you are not able to play.", casinochan);
            return;
        }
        bet = parseInt(commandData, 10);
        if (isNaN(bet)) {
            casinobot.sendMessage(src, "You use it like /craps [number of coins you are betting].", casinochan);
            return;
        }
        if (global.coins[sys.name(src).toLowerCase()] < bet) {
            casinobot.sendMessage(src, "You don't have enough coins to make that bet.", casinochan);
            return;
        }
        if (bet > 100) {
            casinobot.sendMessage(src, "The max bet is 100 coins.", casinochan);
            return;
        }
        if (bet < 1) {
            casinobot.sendMessage(src, "The min bet is 1 coin.", casinochan);
            return;
        }
        dice1 = Math.floor((Math.random() * 6) + 1);
        dice2 = Math.floor((Math.random() * 6) + 1);
        global.coins[sys.name(src).toLowerCase()] -= bet;
        crapsdice = dice1 + dice2;
        if (crapsdice === 7 || crapsdice === 11) {
            payout = Math.floor(bet * 2.5);
            casinobot.sendMessage(src, "You rolled a " + crapsdice + " and got " + payout + " coins!", casinochan);
            global.coins[sys.name(src).toLowerCase()] += payout;
            return;
        } else if (crapsdice === 4 || crapsdice === 5 || crapsdice === 6 || crapsdice === 8 || crapsdice === 9 || crapsdice === 10) {
            var extra1 = Math.floor((Math.random() * 6) + 1),
                extra2 = Math.floor((Math.random() * 6) + 1),
                extra = extra1 + extra2;
            if (crapsdice === extra) {
                payout = Math.floor(bet * 1.75);
                casinobot.sendMessage(src, "You rolled a " + crapsdice + " and a " + extra + " and got " + payout + " coins!", casinochan);
                global.coins[sys.name(src).toLowerCase()] += payout;
                return;
            } else {
                casinobot.sendMessage(src, "Your two rolls of " + crapsdice + " and " + extra + " didn't match so you lost " + bet + " coins.", casinochan);
                return;
            }
        } else {
            casinobot.sendMessage(src, "You rolled a " + crapsdice + " and lost " + bet + " coins!", casinochan);
            return;
        }
    };
	this.playSlots = function (src) {
        var slot;
        if (isNaN(global.coins[sys.name(src).toLowerCase()])) {
            global.coins[sys.name(src).toLowerCase()] = 100;
        }
		slot = Math.floor((Math.random() * 300) + 1);
		if (slot === 1) {
			global.coins[sys.name(src).toLowerCase()] += jackpot;
			casinobot.sendMessage(src, "You hit the jackpot!!!  You got " + jackpot + " coins!", casinochan);
			casinobot.sendAll(sys.name(src) + " just hit the jackpot and got " + jackpot + " coins in #Casino!!!!!", 0);
			jackpot = 1000;
			return;
		}
		if (slot <= 5) {
			global.coins[sys.name(src).toLowerCase()] += 150;
			casinobot.sendMessage(src, "You hit a great number and got 150 coins!!!", casinochan);
			jackpot += 1;
			return;
		}
		if (slot <= 14) {
			global.coins[sys.name(src).toLowerCase()] += 100;
			casinobot.sendMessage(src, "You hit a good number and got 100 coins!!", casinochan);
			jackpot += 1;
			return;
		}
		if (slot <= 30) {
			global.coins[sys.name(src).toLowerCase()] += 50;
			casinobot.sendMessage(src, "You hit an okay number and got 50 coins!", casinochan);
			jackpot += 1;
			return;
		}
		if (slot <= 53) {
			global.coins[sys.name(src).toLowerCase()] += 10;
			casinobot.sendMessage(src, "Your got lucky and won 10 coins.", casinochan);
			jackpot += 1;
			return;
		}
		if (slot <= 85) {
			global.coins[sys.name(src).toLowerCase()] += 2;
			casinobot.sendMessage(src, "You got 2 coins.  It is better than nothing.", casinochan);
			jackpot += 1;
			return;
		} else {
			casinobot.sendMessage(src, "Your luck wasn't good enough for you to win. Better luck next time.", casinochan);
			jackpot += 1;
			return;
		}
	};
    
    this.prTable = [
        [1, 1, 0, 2, 0, 2],
        [1, 1, 2, 0, 2, 0],
        [2, 0, 1, 2, 1, 0],
        [0, 2, 0, 1, 2, 1],
        [2, 2, 1, 0, 1, 0],
        [0, 0, 2, 1, 2, 1]
    ];
    
    // Electric [1] Fire [2] Water [3] Grass [4] Psychic [5] Ground [6]
    this.prNames = ["Electric", "Fire", "Water", "Grass", "Psychic", "Ground"];
    
    // result can be:
    // 0: win
    // 1: tie
    // 2: lose
    this.playPR = function (src, commandData) {
        var data = (commandData || "").split(":"),
            choices = (data[1] || "").split("-"),
            aiChoices = [],
            name = sys.name(src).toLowerCase(),
            result = 1,
            stats = [0, 0, 0],
            nores = false,
            possibleChoices = [1, 2, 3, 4, 5, 6],
            i = 4;
        
        if (data.length !== 2 || choices.length !== 3) {
            casinobot.sendMessage(src, "You play it like this: /pr bet:type1-type2-type3", casinochan);
            return;
        }
        
        data[0] = parseInt(data[0], 10);
		if (!global.coins.hasOwnProperty(name)) {
            global.coins[name] = 100;
        }
        if (isNaN(global.coins[name])) {
            global.coins[name] = 1;
        }
		if (global.coins[name] <= 0) {
			casinobot.sendMessage(src, "You don't have any coins so you are not able to play.", casinochan);
			return;
		}
        if (isNaN(data[0])) {
			casinobot.sendMessage(src, "Specify a valid amount of coins.", casinochan);
			return;
		}
        if (data[0] > global.coins[name]) {
			casinobot.sendMessage(src, "You don't have that many coins!", casinochan);
			return;
		}
        if (data[0] > 100) {
			casinobot.sendMessage(src, "The max bet is 100 coins.", casinochan);
			return;
		}
        if (choices[0] === choices[1] || choices[0] === choices[2] || choices[1] === choices[2]) {
            return casinobot.sendMessage(src, "All types must be different (so you can't do Electric [1] twice, for example).", casinochan);
        }
        
        while (--i) {
            aiChoices.push(possibleChoices[Math.floor(Math.random() * choices.length)]);
            possibleChoices.splice(possibleChoices.indexOf(aiChoices[aiChoices.length - 1]), 1); // get rid of the last push
        }
        
        casinobot.sendMessage(src, "Your choices: " + choices.map(function (choice) {
            return casino.prNames[parseInt(choice, 10) - 1] || "Unknown";
        }).join(" | "), casinochan);
        casinobot.sendMessage(src, "Pikachu's choices: " + aiChoices.map(function (choice) {
            return casino.prNames[choice - 1] || "ERR [report this]";
        }).join(" | "), casinochan);
        
        choices.forEach(function (choice, index, choices) {
            var result;
            if (isNaN(parseInt(choice, 10)) || casino.prNames[parseInt(choice, 10) - 1] === undefined) {
                nores = true;
                casinobot.sendMessage(src, "Choice " + (index + 1) + " is not valid (all choices are numbers and separated with -). Choices can be:", casinochan);
                return casinobot.sendMessage(src, "Electric [1] | Fire [2] | Water [3] | Grass [4] | Psychic [5] | Ground [6]", casinochan);
            }
            
            result = casino.prTable[parseInt(choice, 10) - 1][aiChoices[index] - 1];
            
            switch (result) {
            case 0:
                ++stats[0]; // win
                break;
            case 1:
                ++stats[1]; // tie
                break;
            case 2:
                ++stats[2]; // lose
                break;
            }
        });
        
        if (nores) {
            return;
        }
        
        if (stats[0] > stats[2]) {
            casinobot.sendMessage(src, "You won! Enjoy " + (Math.floor(data[0] * 2)) + " coins!", casinochan);
            global.coins[name] += Math.floor(data[0] * 2);
        } else if (stats[2] > stats[0]) {
            casinobot.sendMessage(src, "You lost! There goes " + data[0] + " coins. :(", casinochan);
            global.coins[name] -= data[0];
        } else {
            casinobot.sendMessage(src, "You tied! Try again.", casinochan);
        }
    };
    this.showGames = function (src, commandData) {
        var games = [
            "Chuck-a-luck - Choose any number that 3 dice can make.  If the dice come up with your number you win.",
            "Craps - Roll the dice if you roll 7 or 11 you get 5 times your bet. Roll a 4, 5, 6, 8, 9, or 10 then roll another pair of dice and if they number match you get double your bet. Roll 2 or 12 and you lose.",
            "Slots - Press your luck with this game.  You better hope your lucky number comes up.",
            "Pikachu's Roulette - Defeat Pikachu with types. See http://gamecorner.info/Thread-Game-Pikachu-s-Roulette for more information."
        ];
        
        games.forEach(function (msg) {
            casinobot.sendMessage(src, msg, casinochan);
        });
    };
    this.showmyCoins = function (src) {
        var myCoins = global.coins[sys.name(src).toLowerCase()];
        
        if (isNaN(myCoins)) {
            myCoins = 100;
        }
        casinobot.sendMessage(src, "You have " + myCoins + " coins right now.", casinochan);
        return;
    };
    this.showJackpot = function (src) {
        casinobot.sendMessage(src, "The current jackpot is " + jackpot + " coins!", casinochan);
        return;
    };
    this.showHelp = function (src, commandData) {
        if (commandData) {
            commandData = commandData.toLowerCase();
        }
        if (commandData === "chuck" || commandData === "cal" || commandData === "chuck a luck") {
            casinobot.sendMessage(src, "To play type /cal [bet]:[number you are trying to hit]. bet is how many coins you are risking and number is the number you are trying to roll.", casinochan);
            return;
        } else if (commandData === "craps") {
            casinobot.sendMessage(src, "To play type /craps [bet].  bet is how many coins you are risking.");
            return;
        } else if (commandData === "slots") {
            casinobot.sendMessage(src, "To play type /slots. You win depend on how lucky you are.");
            return;
        } else if (commandData === "pr") {
            casinobot.sendMessage(src, "To play type /pr [bet]:[choice1-choice2-choice3]. See http://gamecorner.info/Thread-Game-Pikachu-s-Roulette for more info.", casinochan);
            return;
        } else {
            var help = [
                "",
                "Type /help cal or /help chuck a luck to learn how to play Chuck a Luck. :",
                "Type /help craps to learn how to play Craps. :",
                "Type /help slots to learn how to play Slots. :",
                "Type /help pr to learn how to play Pikachu's Roulette. :",
                ""
            ];
            
            return help.forEach(function (msg) {
                sendChanMessage(src, msg, casinochan);
            });
        }
    };
    this.showCommands = function (src, commandData) {
        var some = [
            "*** CASINO Commands ***",
            "/cal [bet:number]: To play Chuck A Luck.",
            "/craps [bet]: To play Craps.",
            "/slots: To play Slots.",
            "/pr [bet]:[choice1-choice2-choice3]: To play Pikachu's Roulette.",
            "/help: To learn how to play the games.",
            "/games: To see all the games you are able to play.",
            "/jackpot: To see what the current jackpot is.",
            "/mycoins: To find out how many coins you have.",
            ""
		];
        
        some.forEach(function (msg) {
            sendChanMessage(src, msg, casinochan);
        });
	};
    this.commands = {
        user: {
            cal: this.playCAL,
            craps: this.playCraps,
	        slots: this.playSlots,
            pr: this.playPR,
            help: this.showHelp,
            games: this.showGames,
            jackpot: this.showJackpot,
            mycoins: this.showmyCoins,
            casinocommands: this.showCommands
        }
	};
    this.handleCommand = function (src, message, channel) {
        var command,
            commandData,
            pos = message.indexOf(' ');
        
        if (pos !== -1) {
            command = message.substring(0, pos).toLowerCase();
            commandData = message.substr(pos + 1);
        } else {
            command = message.substr(0).toLowerCase();
        }
        
        if (channel !== casinochan && ['casinocommands'].indexOf(command) === -1) {
            return;
        }
        if (casino.poker.handleCommand(src, message, channel) === true) {
            return true;
        }
        if (['cal', 'craps', 'slots', 'pr'].indexOf(command) !== -1) {
            if (cooldowns[src]) {
                casinobot.sendMessage(src, "Don't be so eager to lose all your coins!", casinochan);
                return true;
            }
            cooldowns[src] = true;
            sys.setTimer(function () {
                delete cooldowns[src];
            }, casinoCommandCooldown * 1000, false);
        }
        
        if (casino.commands.user.hasOwnProperty(command)) { //Ricetip: You will need this block to make commands work.
            casino.commands.user[command].call(casino, src, commandData);
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
        casino.chan = casinochan;
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
        beforeChannelJoin: casino.beforeChannelJoin,
        // todo: make this run
        step: function () {
            //if (++stepTimer % 60 === 0) { // every minute
              //  casino.memoryHash.add('coins', JSON.stringify(global.coins));
            //}
            
            casino.poker.step();
        },
        onHelp: function (src, topic, channel) {
            if (topic === "casino") {
                casino.handleCommand(src, "casinocommands", channel);
                return true;
            }
        },
        "help-string": "casino: To know of casino commands."
    };
}());
