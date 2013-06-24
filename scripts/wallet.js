/*global casino, casinobot, sys, module, SESSION*/
function Casino() {
    var wallet = this;
    
    var allowance = 5;
    var startingCoins = 1000;
    
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
            /* 
            var now = new Date();
            now = now.getUTCDate() + "*" + now.getUTCMonth() + "*" + now.getUTCFullYear();
            sys.saveVal("CasinoAllowance", name.toLowerCase(), now); */
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
        
        var key = sys.getVal("CasinoAllowance", name.toLowerCase());
        var now = new Date();
        now = now.getUTCDate() + "*" + (now.getUTCMonth() + 1) + "*" + now.getUTCFullYear();
        
        if (now !== key) {
            this.addCoins(src, allowance);
            sys.removeVal(name.toLowerCase(), "CasinoAllowance");
            sys.saveVal("CasinoAllowance", name.toLowerCase(), now);
            
            casinobot.sendMessage(src, "You received your daily allowance of " + allowance + " coins!", chan);
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
