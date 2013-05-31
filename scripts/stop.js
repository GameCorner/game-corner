/*global stopbot, sys, module*/
function StopGame(stopchan) {
    var stopGame = this;
    var state;
    var theme;
    var points = [20, 17, 14, 12, 10, 8, 6, 4, 2, 1];
    var themes = {};
    var currentTheme;
    var defaultTheme = "pokemon";
    
    var border = "***************************************************************************************";
    // var answerSymbol = "=";
    var currentAnswers = {};
    var usedLetters = [];
    var possibleLetters = {};
    var currentLetter = "";
    var players = {};
    var ticks = 0;
    var lowCaseAnswers = [];
    var admins = ["kirby", "icekirby", "ricekirby", "black mage", "thepiggy"];

    this.startTheme = function(src, data) {
        var name = sys.name(src);
        
        theme = data;
        currentTheme = themes[data];
        lowCaseAnswers = currentTheme.answers.map(function(x) { return x.toLowerCase(); } );
        possibleLetters = {};
        for (var l in lowCaseAnswers) {
            possibleLetters[lowCaseAnswers[l][0]] = true;
        }
        
        sys.sendAll("", stopchan);
        sys.sendAll(border, stopchan);
        stopbot.sendAll(name + " started a " + cap(currentTheme.name) + "-themed Stop game! Type /join to play (You have 30 seconds)!", stopchan);
        sys.sendAll("±Description: " + currentTheme.description, stopchan);
        sys.sendAll(border, stopchan);
        sys.sendAll("", stopchan);
        
        state = "Entry";
        players = {};
        usedLetters = [];
        ticks = 30;
    };
    this.startRound = function() {
        currentAnswers = {};
        for (var p in players) {
            players[p].answered = false;
        }
        
        var alphabet = "abcdefghijklmnopqrstuvwxyz";
        var count = 0;
        do {
            currentLetter = alphabet[Math.floor(Math.random() * alphabet.length)];
            count++;
            if (count > 200) {
                stopbot.sendAll("An error occured and the game was interrupted!", stopchan);
                this.endGame();
                return;
            }
        } while (usedLetters.indexOf(currentLetter) >= 0 || !(currentLetter in possibleLetters));
        usedLetters.push(currentLetter);
        
        sys.sendAll("", stopchan);
        sys.sendAll(border, stopchan);
        stopbot.sendAll("Round " + usedLetters.length + " is starting! You have 30 seconds to say a " + currentTheme.title + " name starting with " + currentLetter.toUpperCase() + "! ", stopchan);
        sys.sendAll(border, stopchan);
        sys.sendAll("", stopchan);
        ticks = 30;
    };
    this.validateAnswer = function(src, answer) {
        var name = sys.name(src);
        
        if (!isInGame(name)) {
            stopbot.sendMessage(src, "You are not in the game! Type /join to join the game.", stopchan);
            return;
        }
        if (players[name].answered !== false) {
            stopbot.sendMessage(src, "You already answered this round! Wait for the next round.", stopchan);
            return;
        }
        if (answer.toLowerCase() in currentAnswers) {
            stopbot.sendMessage(src, "This answer was already used!", stopchan);
            return;
        }
    
        if (answer[0].toLowerCase() === currentLetter && lowCaseAnswers.indexOf(answer.toLowerCase()) >= 0) {
            var pointsGained = points[Object.keys(currentAnswers).length];
            players[name].points += pointsGained;
            players[name].answered = true;
            currentAnswers[answer.toLowerCase()] = name;
            var correctCase = currentTheme.answers[lowCaseAnswers.indexOf(answer.toLowerCase())];
            stopbot.sendAll(name + " answered " + correctCase + " and got " + pointsGained + " points!", stopchan);
        } else {
            stopbot.sendMessage(src, "Invalid answer! Try again!", stopchan);
        }
    };
    this.joinGame = function(name) {
        players[name] = {
            "answered": false,
            "points": 0
        };
        stopbot.sendAll(name + " joined the game!", stopchan);
    };
    this.unjoinGame = function(src) {
        var name = sys.name(src);
        if (isInGame(name)) {
            delete players[name];
            stopbot.sendAll(name + " left the game!", stopchan);        
        } else {
            stopbot.sendMessage(src, "You didn't even join!", stopchan);
        }
    };
    this.interruptGame = function(src) {
        var name = sys.name(src);
        if (admins.indexOf(name.toLowerCase()) !== -1) {
            if (state !== "Blank") {
                stopbot.sendAll(name + " stopped the game!", stopchan);
                this.endGame();
            } else {
                stopbot.sendMessage(src, "No game running!", stopchan);
            }
        } else {
            stopbot.sendMessage(src, "You can't use this command!", stopchan);
        }
    };
    this.endGame = function() {
        state = "Blank";
        sys.sendAll("", stopchan);
        sys.sendAll(border, stopchan);
        sys.sendAll("=== Game is over! ===:", stopchan);
        ticks = 30;
        var names = Object.keys(players);
        names.sort(function(a,b) { return players[b].points - players[a].points; } );
        for (var p = 0; p < names.length; ++p) {
            stopbot.sendAll(names[p] + " got " + players[names[p]].points + " points!", stopchan);
        }
        sys.sendAll(border, stopchan);
        sys.sendAll("", stopchan);
    };

    function isInGame(name) {
        return name in players;
    }
    function cap(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }
    
    this.showCommands = function(src) {
        var out = [
            "",
            "/a [word]: To answer a name.",
            "/start [theme]: To start a game.",
            "/join: To join a game.",
            "/unjoin: To leave a game.",
            "/end: To stop a game (admin-only).",
            ""
        ];
        
        for (var x in out) {
            sys.sendMessage(src, out[x], stopchan);
        }
    };
    this.init = function() {
        var name = "Stop";
    	if (sys.existChannel(name)) {
            stopchan = sys.channelId(name);
        } else {
            stopchan = sys.createChannel(name);
        }
        
        state = "Blank";
        players = {};
        theme = null;
        ticks = 0;
        
        try {
            themes = JSON.parse(sys.getFileContent("stopThemes.json"));
        } catch (err) {
            sys.writeToFile("stopThemes.json", JSON.stringify({}));
            themes = {};
        }
        
        stopbot.sendAll("STOP Game was reloaded, please start a new game!", stopchan);
    };
    this.updateThemes = function (src, data) {
        try {
            if (data === "*") {
                stopbot.sendMessage(src, "Please specify an URL!", stopchan);
                return;
                
            } else {
                stopbot.sendMessage(src, "Loading Stop themes from " + data, stopchan);
                sys.webCall(data, function(content) {
                    themes = JSON.parse(content);
                    sys.writeToFile("stopThemes.json", content);
                    stopbot.sendAll("STOP themes updated!", stopchan);
                });
            }
            
        } catch (err) {
            stopbot.sendMessage(src, "Error loading Stop themes from " + data + ": " + err, stopchan);
        }
    };
    this.stepEvent = function() {
        stopGame.tickDown();
	};
    this.tickDown = function() {
        if (ticks > 0) {
            ticks--;
            if (ticks <= 0) {
                if (state === "Entry") {
                    state = "Running";
                    this.startRound();
                } else if (state === "Running") {
                    if (usedLetters.length >= 10) {
                        this.endGame();
                    } else {
                        this.startRound();
                    }
                } 
            }
        }
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
			stopGame.handleStopCommand(src, command, commandData, channel);
            return true;
        } catch(e) {
            if (e !== "No valid command") {
                sys.sendAll("Error on Stop command" + (e.lineNumber ? " on line " + e.lineNumber : "") + ": " + e, stopchan);
                if (sys.id("RiceKirby") !== undefined) {
                    sys.sendMessage(sys.id("RiceKirby"), "Error on Stop command" + (e.lineNumber ? " on line " + e.lineNumber : "") + ": " + e + " [" + sys.name(src) + " typed /" + message + "]", stopchan);
                }
                return true;
            }
        }
    };
    this.handleStopCommand = function(src, command, data, chan) {
        var name = sys.name(src);
        
        if (command === "a") {
            if (state === "Running") {
                this.validateAnswer(src, data);
            } else {
                stopbot.sendMessage(src, "No game running! Use /start [theme] to start a game!!", stopchan);
            }
            return true;
        } else if (command === "start") {
            if (state === "Blank") {
                this.startTheme(src, themes.hasOwnProperty(data.toLowerCase()) ? data.toLowerCase() : defaultTheme);
            } else {
                stopbot.sendMessage(src, "You can't start a new game now! Wait for the current game to end!", stopchan);
            }
            return true;
        } else if (command === "join") {
            if (state !== "Blank") {
                if (!isInGame(name)) {
                    if (Object.keys(currentAnswers).length < points.length) {
                        this.joinGame(name);
                    } else {
                        stopbot.sendMessage(src, "All slots filled!", stopchan);
                    }
                }
            } else {
                stopbot.sendMessage(src, "No game running! Use /start [theme] to start a game!", stopchan);
            }
            return true;
        } else if (command === "unjoin") {
            this.unjoinGame(src);
            return true;
        } else if (command === "end") {
            this.interruptGame(src);
            return true;
        } else if (command === "commands" && chan === stopchan) {
            this.showCommands(src);
            return true;
        } else if (command === "loadthemes") {
            if (name === "RiceKirby") {
                this.updateThemes(src, data);
                return true;
            } 
        }
        
        throw("No valid command");
    };
}

module.exports = function() {
    var id;
    var init = function() {
        var name = "Stop";
        if (sys.existChannel(name)) {
            id = sys.channelId(name);
        } else {
            id = sys.createChannel(name);
        }
    };

    var game = new StopGame(id);

    return {
        game: game,
        init: game.init,
        handleCommand: game.handleCommand,
        // beforeLogOut: game.beforeLogOut,
        // beforeSendMessage: game.beforeSendMessage,
        // afterChannelMessage: game.afterChannelMessage,
        stepEvent: game.stepEvent
    };
}();
