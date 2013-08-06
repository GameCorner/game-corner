/*global casino, casinobot, sys, module, SESSION*/
function Casino() {
    var wallet = this;
    
    var startingCoins = 1000;
    var allowance = [5, 10, 15, 20];
    var milestones = [0, 3, 10, 30];
    
    this.enterCasino = function(src, data, chan) {
        if (this.IsInCasino(src)) {
            casinobot.sendMessage(src, "You already entered the casino!", chan);
            return;
        }
        
        var name = sys.name(src);
        var user = SESSION.users(src);
        var key = sys.getVal("Casino", name.toLowerCase());
        if (key || key === "0") {
            user.casino = {
                name: name,
                coins: parseInt(key, 10)
            };
        } else {
            user.casino = {
                name: name,
                coins: startingCoins
            };
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
    this.getAllowance = function(src, data, chan) {
        if (!this.IsInCasino(src)) {
            casinobot.sendMessage(src, "You are not in the casino! Type /entercasino to join!", chan);
            return;
        }
        
        var name = SESSION.users(src).casino.name;
        var today = Math.floor(new Date().getTime() / (1000 * 60 * 60 * 24));
        
        var key = sys.getVal("CasinoAllowance", name.toLowerCase());
        var day = 0, row = 0;
        
        if (key && key.indexOf("*") !== -1) {
            key = key.split("*");
            day = parseInt(key[0], 10);
            row = parseInt(key[1], 10);
        }
        
        if (today !== day) {
            if (today - day === 1) {
                row += 1;
            } else {
                row = 0;
            }
            
            var received;
            for (var r = milestones.length - 1; r >= 0; --r) {
                if (row >= milestones[r]) {
                    received = allowance[r];
                    break;
                }
            }
            
            this.addCoins(src, received);
            sys.removeVal(name.toLowerCase(), "CasinoAllowance");
            sys.saveVal("CasinoAllowance", name.toLowerCase(), today + "*" + row);
            
            casinobot.sendMessage(src, "You received your daily allowance of " + received + " coins!", chan);
        } else {
            casinobot.sendMessage(src, "You already received your daily allowance today!", chan);
        }
    };
    this.giveCoins = function(src, data, chan) {
        var info = data.split(":");
        if (info.length < 2) {
            casinobot.sendMessage(src, "Invalid format! Use /givecoins [name]:[coins].", chan);
            return;
        }
        
        var target = sys.id(info[0]);
        if (target === undefined || this.IsInCasino(target) === false) {
            casinobot.sendMessage(src, "This person is not in the Casino!", chan);
            return;
        }
        var amount = parseInt(info[1], 10);
        if (isNaN(amount)) {
            casinobot.sendMessage(src, "Invalid value! You must specify a valid integer!", chan);
            return;
        }
        
        this.addCoins(target, amount);
        if (amount > 0) {
            casinobot.sendMessage(src, "You gave " + amount + " coins to " + sys.name(target) + "!", chan);
            casinobot.sendMessage(target, "You received " + amount + " coins from " + sys.name(src) + "!");
        } else if (amount < 0) {
            casinobot.sendMessage(src, "You took " + (-amount) + " coins from " + sys.name(target) + "!", chan);
            casinobot.sendMessage(target, sys.name(src) + " took " + (-amount) + " coins from you!");
        }
    };
    this.viewUserCoins = function(src, data, chan) {
        if (sys.id(data) === undefined) {
            casinobot.sendMessage(src, "No such person!", chan);
            return;
        }
        if (this.IsInCasino(sys.id(data))) {
            casinobot.sendMessage(src, sys.name(sys.id(data)) + " currently have " + SESSION.users(sys.id(data)).casino.coins + " Coin(s)!", chan);
        } else {
            casinobot.sendMessage(src, "That person is not in the casino!", chan);
        }
    };
    this.viewCoins = function(src, data, chan) {
        if (this.IsInCasino(src)) {
            casinobot.sendMessage(src, "You currently have " + SESSION.users(src).casino.coins + " Coin(s)!", chan);
        } else {
            casinobot.sendMessage(src, "You are not in the casino! Type /entercasino to join!", chan);
        }
    };
    
    this.IsInCasino = function(src) {
        return SESSION.users(src).hasOwnProperty("casino") && SESSION.users(src).casino !== null;
    };
    
    this.init = function() {
		setWallet();
    };
    
    function setWallet() {
        var plug = SESSION.global().plugins;
        for (var p in plug) {
            if (plug[p].source === "wallet.js") {
                casino = plug[p];
                break;
            }
        }
    }
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
			wallet.handleWalletCommand(src, command, commandData, channel);
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
        } else if (command === "coins" || command === "mycoins") {
            this.viewCoins(src, data, chan);
            return true;
        } else if (command === "allowance") {
            this.getAllowance(src, data, chan);
            return true;
        } else if (command === "givecoins" && sys.auth(src) >= 2) {
            this.giveCoins(src, data, chan);
            return true;
        } else if (command === "viewcoins" && sys.auth(src) >= 2) {
            this.viewUserCoins(src, data, chan);
            return true
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
