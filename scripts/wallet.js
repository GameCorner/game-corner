/*global casino, casinobot, sys, module, getKey, saveKey, sendChanAll, SESSION*/
function Casino() {
    var casino = this;
    this.enterCasino = function(src, data, chan) {
        if (this.IsInCasino(src)) {
            casinobot.sendMessage(src, "You already entered the casino!", chan);
            return
        }
        
        var name = sys.name(src);
        var user = SESSION.users(src);
        var key = sys.getVal("Casino", name.toLowerCase());
        if (key || key === "0") {
            user.casino = {
                name: name,
                coins: parseInt(key, 10)
            }
        } else {
            user.casino = {
                name: name,
                coins: 1000
            }
        }
        
        sys.saveVal("Casino", name.toLowerCase(), user.casino.coins);
        casinobot.sendMessage(src, "You have " + user.casino.coins + " Coin(s)!", chan);
    };
    
    this.addCoins = function(src, amount) {
        if (!this.IsInCasino(src)) {
            return 0;
        }
        
        var user = SESSION.users(src).casino;
        user.coins += amount;
        if (user.coins < 0) {
            user.coins = 0;
        }
        
        sys.removeVal(user.name.toLowerCase(), "Casino");
        sys.saveVal("Casino", user.name.toLowerCase(), user.coins);
        return user.coins;
    };
    this.viewCoins = function(src, data, chan) {
        if (this.IsInCasino(src)) {
            casinobot.sendMessage(src, "You currently have " + SESSION.users(src).casino.coins + " Coin(s)!", chan);
        } else {
            casinobot.sendMessage(src, "You are not in the casino! Type /entercasino to join!", chan);
        }
    }
    
    this.IsInCasino = function(src) {
        return SESSION.users(src).hasOwnProperty("casino") && SESSION.users(src).casino !== null;
    };
    
    this.init = function() {
		
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
        
        try {
			casino.handleWalletCommand(src, command, commandData, channel);
            return true;
        } catch(e) {
            if (e !== "No valid command") {
                sys.sendAll("Error on Casino command" + (e.lineNumber ? " on line " + e.lineNumber : "") + ": " + e, channel);
                return true;
            }
        }
    };
    this.handleWalletCommand = function(src, command, data, chan) {
        var name = sys.name(src);
        
        if (command === "entercasino") {
            this.enterCasino(src, data, chan);
            return true;
        } else if (command === "coins") {
            this.viewCoins(src, data, chan);
            return true;
        }
        throw("No valid command");
    };
}

module.exports = function() {
    var init = function() {
        
    };

    var game = new Casino();
    
    return {
        casino: game,
        init: game.init,
        handleCommand: game.handleCommand,
        addCoins: game.addCoins,
        IsInCasino: game.IsInCasino
    };
}();
