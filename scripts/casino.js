/*global casinobot, sys, module, sendChanAll, SESSION*/
var CASINO_CHANNEL = "Casino";
function Casino(casinochan) {
    var game = this;
    var border = "***************************************************************************************";
    
    var ticks;
    var commandCooldown = 6;
    var cooldowns = {};
    
    this.playSlots = function(src, data) {
        var bet = parseInt(data, 10);
        if (isNaN(bet) || bet < 1 || bet > 3) {
            casinobot.sendMessage(src, "Invalid bet! You must bet 1, 2 or 3 coins!", casinochan);
            return;
        }
        
        // var symbols = ["∞", "★", "✿", "❤", "☼", "✧", "☾", "☁", "☯", "☺", "☎", "☽", "✰", "☢", "♞", "♝", "△", "▲", "❦", "☮"];
        var symbols = ["❤", "★", "✰", "✿", "✧", "☾", "☯", "☮"];
        var s = symbols.length;
        
        // Reels
        var reel1 = [7, 4, 6, 2, 5, 3, 6, 3, 7, 2, 4, 1, 6, 5, 7, 0, 5, 7, 6, 1, 3, 4, 2, 7, 5, 6, 7, 4, 2, 6, 3];
        var reel2 = [6, 5, 3, 7, 2, 4, 7, 2, 5, 6, 3, 1, 7, 6, 4, 0, 6, 4, 7, 1, 2, 7, 3, 6, 4, 5, 6, 2, 3, 5, 7];
        var reel3 = [6, 3, 2, 6, 4, 7, 5, 6, 4, 7, 2, 1, 5, 7, 3, 0, 2, 6, 5, 1, 4, 7, 6, 5, 7, 3, 4, 7, 6, 3, 2];
        
        // Lines to be checked for a winning combination
        var validLines = [
            [[1, 0], [1, 1], [1, 2]]
        ];
        if (bet >= 2) {
            validLines.push([[0, 0], [0, 1], [0, 2]], [[2, 0], [2, 1], [2, 2]]);
            if (bet >= 3) {
                validLines.push([[0, 0], [1, 1], [2, 2]], [[2, 0], [1, 1], [0, 2]]);
            }
        }
        
        // Final position for each reel
        var results = [[], [], []];
        var first = sys.rand(0, reel1.length);
        var second = sys.rand(0, reel2.length);
        var third = sys.rand(0, reel3.length);
        results[0].push(reel1[first], reel2[second], reel3[third]);
        results[1].push(reel1[(first + 1) % s], reel2[(second + 1) % s], reel3[(third + 1) % s]);
        results[2].push(reel1[(first + 2) % s], reel2[(second + 2) % s], reel3[(third + 2) % s]);
        
        // Visual output
        sys.sendMessage(src, "*** " + bet + " COIN" + (bet > 1 ? "S" : "") + " SLOTS ***", casinochan);
        sys.sendHtmlMessage(src, '<span style="font-size:20px;">*** |' + symbols[results[0][0]] + '| |' + symbols[results[0][1]] + '| |' + symbols[results[0][2]] + '| ***<br/>*** |' + symbols[results[1][0]] + '| |' + symbols[results[1][1]] + '| |' + symbols[results[1][2]] + '| ***<br/>*** |' + symbols[results[2][0]] + '| |' + symbols[results[2][1]] + '| |' + symbols[results[2][2]] + '| ***</span>', casinochan);
        
        // Check for winning combinations
        var combination, wincomb, l, line, c, reward = 0, tempReward = 0, pot = "none";
        for (l in validLines) {
            combination = [];
            for (c in validLines[l]) {
                line = validLines[l][c];
                combination.push(results[line[0]][line[1]]);
            }
            
            if (findPattern([0, 0, 0], combination)) {
                reward = [5000, 1500, 1000][bet - 1];
                pot = "Jackpot";
                break;
            } else if (findPattern([1, 1, 1], combination)) {
                tempReward = [2500, 750, 500][bet - 1];
                pot = "Minipot";
            } else if (findPattern([0, 0, 1], combination)) {
                tempReward = [1900, 550, 350][bet - 1];
            } else if (findPattern([0, 1, 1], combination)) {
                tempReward = [1200, 300, 150][bet - 1];
            } else if (findPattern([0, 2, 3], combination)) {
                tempReward = [300, 100, 75][bet - 1];
            } else if (findPattern([1, 5, 4], combination)) {
                tempReward = [150, 50, 35][bet - 1];
            } else if (findPattern([6, 6, 6], combination) || findPattern([7, 7, 7], combination)) {
                tempReward = [10, 4, 2][bet - 1];
            } else if ((combination[0] === 6 && combination[1] === 6 ) || (combination[1] === 6 && combination[2] === 6 ) || (combination[0] === 6 && combination[2] === 6 )) {
            } else if ((combination[0] === 7 && combination[1] === 7 ) || (combination[1] === 7 && combination[2] === 7 ) || (combination[0] === 7 && combination[2] === 7 )) {
            } else if (combination[0] === combination[1] && combination[0] == combination[2]) {
                tempReward = [55, 15, 10][bet - 1];
            } else if (combination[0] === combination[1] || combination[0] == combination[2] ||  combination[1] == combination[2]) {
                tempReward = [15, 5, 4][bet - 1];
            }
            if (tempReward > reward) {
                reward = tempReward;
                wincomb = combination;
            }
        }
        
        if (reward) {
            var realGain = reward - bet;
            casino.addCoins(src, realGain);
            casinobot.sendMessage(src, "You got " + wincomb.map(function(x){ return "[" + symbols[x] + "]"; }).join("") +  " and won " + reward + " coins!", casinochan);
            if (pot === "Jackpot") {
                sys.sendAll("", 0);
                sys.sendAll(border, 0);
                casinobot.sendAll(sys.name(src) + " just won the " + reward + " Coin " + pot + " on the Slots at #" + sys.channel(casinochan), 0);
                sys.sendAll(border, 0);
                sys.sendAll("", 0);
            }
            if (pot !== "none") {
                sys.sendAll("", casinochan);
                casinobot.sendAll(sys.name(src) + " just won the " + reward + " Coin " + pot + " on the Slots.", casinochan);
                sys.sendAll("", casinochan);
            }
        } else {
            casino.addCoins(src, -bet);
            casinobot.sendMessage(src, "Better luck next time.", casinochan);
        }
        sys.sendMessage(src, "", casinochan);
    };
    
    function findPattern(pattern, arr) {
        var testArray = arr.concat();
        var patternArr = pattern.concat();
        
        var index, p;
        for (p = testArray.length - 1; p >= 0; --p) {
            index = patternArr.indexOf(testArray[p]);
            if (index !== -1) {
                patternArr.splice(index, 1);
                testArray.splice(p, 1);
            } else {
                return false;
            }
        }
        
        return testArray.length === 0 && patternArr.length === 0;
    }
    
    this.games = {
        slots: [this.playSlots, "To play Slots."]
    };
    
    this.init = function() {
		if (sys.existChannel(CASINO_CHANNEL)) {
            casinochan = sys.channelId(CASINO_CHANNEL);
        } else {
            casinochan = sys.createChannel(CASINO_CHANNEL);
        }
        
        ticks = 0;
        cooldowns = {};
    };
    this.stepEvent = function() {
        game.tickDown();
	};
    this.tickDown = function() {
        ticks++;
    };
    
    this.casinoHelp = function(src, topic, channel) {
        if (topic === "casino") {
            var some = [
                "",
                "*** CASINO Commands ***",
                "/games: To see all the games you are able to play.",
                "/help: To learn how to play the games."
            ];
            
            for (var s in game.games) {
                some.push("/" + s + ": " + game.games[s][1]);
            }
            
            some.push("");
            
            some.forEach(function (msg) {
                sendChanMessage(src, msg, casinochan);
            });
            return true;
        }
    };
    
    this.showHelp = function(src, data) {
        if (data === "*") {
            sys.sendMessage(src, "", casinochan);
            sys.sendMessage(src, border, casinochan);
            casinobot.sendMessage(src, "To begin playing the casino games, type /entercasino to open your account. You will get an initial amount of 1000 casino coins to play the various games. You can check your balance with /coins.", casinochan);
            casinobot.sendMessage(src, "Each day that you log on, you will get an /allowance by typing the command. The more days in a row you log on and get your allowance, the higher your allowance will get. ", casinochan);
            casinobot.sendMessage(src, "Type /games to view a list of games available and where to play them. If you want to know more about a game, type /help [game name].", casinochan);
            sys.sendMessage(src, border, casinochan);
            sys.sendMessage(src, "", casinochan);
            return;
        }
        var name = data.toLowerCase();
        
        var out;
        switch (name) {
            case "slot":
            case "slots":
                out = ["How to play Slots:",
                    "To play slots, you choose whether to play 1, 2 or 3 coins. 1 coin watches only the middle row. It has the lowest odds, but the highest payouts. 2 coin watches all three rows. It has much better odds, but only a medium pay out. 3 coin watches all three rows and diagonal. It has the best odds, but the lowest payouts. Simply type '/slots 1', '/slots 2' or '/slots 3' to play.",
                    "Combination - Payouts (1 Coin / 2 Coins / 3 Coins): ",
                    "❤❤❤ - 5000 / 1500 / 1000 [Jackpot] ",
                    "★★★ - 2500 / 750 / 500 [Minipot] ",
                    "❤❤★ - 1900 / 550 / 350 ",
                    "❤★★ - 1200 / 300 / 150 ",
                    "❤✰✿ - 300 / 100 / 75 ",
                    "★☾✧ - 150 / 50 / 35 ",
                    "3 match ☯ or ☮ - 10 / 4 / 2 ",
                    "2 match ☯ or ☮ - 0 / 0 / 0 ",
                    "3 matching symbols - 55 / 15 / 10 ",
                    "2 matching symbols - 15 / 5 / 4 "
                ];
                break;
            default:
                casinobot.sendMessage(src, "No such game! If you are looking for help for another channel's game, try typing /help on that channel.", casinochan);
                return;
        }
        sys.sendMessage(src, "", casinochan);
        for (var x in out) {
            sys.sendMessage(src, out[x], casinochan);
        }
        sys.sendMessage(src, "", casinochan);
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
        
        if (channel !== casinochan) {
            return;
        }
        try {
			game.handleCasinoCommand(src, command, commandData, channel);
            return true;
        } catch(e) {
            if (e !== "No valid command") {
                sys.sendAll("Error on Casino command" + (e.lineNumber ? " on line " + e.lineNumber : "") + ": " + e, casinochan);
                if (sys.id("RiceKirby") !== undefined) {
                    sys.sendMessage(sys.id("RiceKirby"), "Error on Casino command" + (e.lineNumber ? " on line " + e.lineNumber : "") + ": " + e + " [" + sys.name(src) + " typed /" + message + "]", casinochan);
                }
                return true;
            }
        }
    };
    this.handleCasinoCommand = function(src, command, data, chan) {
        
        if (command === "help") {
            this.showHelp(src, data);
            return true;
        } else if (command in this.games) {
            if (casino.IsInCasino(src)) {
                if (src in cooldowns && cooldowns[src] > ticks) {
                    casinobot.sendMessage(src, "You need to wait " + commandCooldown + " seconds between each game!", chan);
                } else {
                    this.games[command][0].call(this, src, data);
                    cooldowns[src] = ticks + commandCooldown;
                }
            } else {
                casinobot.sendMessage(src, "You are not in the casino! Type /entercasino to join!", chan);
            }
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
    function cap(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }
}

module.exports = function() {
    var id;
    var init = function() {
        if (sys.existChannel(CASINO_CHANNEL)) {
            id = sys.channelId(CASINO_CHANNEL);
        } else {
            id = sys.createChannel(CASINO_CHANNEL);
        }
    };

    var game = new Casino(id);

    return {
        game: game,
        init: game.init,
        handleCommand: game.handleCommand,
        stepEvent: game.stepEvent,
        onHelp: game.casinoHelp, 
        "help-string": "casino: To know of casino commands."
    };
}();

