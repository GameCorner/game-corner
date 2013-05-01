/*jslint es5: true, evil: true, plusplus: true, sloppy: true, vars: true, forin: true*/
/*global module, require, sys, casinobot, Config, SESSION*/
// &middot;

(function () {
    // constructor
    function DiceSlider(casino) {
        var commands = {},
            fields = ["One Pair", "All Different", "Full House", "Any Combo", "4 Of A Kind", "5 Of A Kind",
                      "1 1 1", "2 2 2", "3 3 3", "4 4 4", "5 5 5", "6 6 6"
                     ];
        
        function sendMessage(src, msg) {
            if (msg === "") {
                return sys.sendMessage(src, "", casino.chan);
            }
            
            casinobot.sendMessage(src, msg, casino.chan);
        }
        
        function sendAll(msg) {
            if (msg === "") {
                return sys.sendAll("", casino.chan);
            }
            
            casinobot.sendAll(msg, casino.chan);
        }
        
        function init(user) {
            var len,
                i;
            
            if (typeof user === 'number') {
                user = SESSION.users(user);
            }
            
            user.ds = {
                state: 'not-playing',
                fields: {},
                dices: [],
                selectedDices: [],
                selectedField: "",
                rollsRemaining: 2,
                score: 0
            };
            
            for (i = 0, len = fields.length; i < len; ++i) {
                user.ds.fields[fields[i]] = false;
            }
            
            return user;
        }
        
        function getSession(id) {
            var user = SESSION.users(id);
                        
            if (!user && typeof id === 'object') {
                user = SESSION.users(id.id);
            }
            
            if (typeof user.ds !== 'object') {
                user = init(user);
            }
            
            return user.ds;
        }
        
        function resetVariables(src) {
            var ds = getSession(src);
            
            ds.state = 'playing';
            ds.dices = [];
            ds.selectedDices = [];
            ds.selectedField = "";
            ds.rollsRemaining = 2;
        }
        
        function giveCoins(id, reward) {
            var coins = SESSION.global().coins,
                name = sys.name(id).toLowerCase();
            
            if (!Object.prototype.hasOwnProperty.call(coins, name)) {
                coins[name] = 100;
            }
            
            coins[name] += reward;
        }
        
        function awardCoins(id) {
            var session = getSession(id),
                coins;
            
            if (session.score === 0) {
                sendMessage(id, "You didn't get any points - so no coins!");
                return;
            }
            
            coins = Math.ceil(session.score / 12);
            
            if (coins < 1) {
                coins = 1;
            }
            
            sendMessage(id, "Final score: " + session.score);
            sendMessage(id, "Coins earned: " + coins);
            giveCoins(id, coins);
        }
        
        function dice() {
            return sys.rand(1, 7);
        }
        
        function rollDice(id) {
            var session = getSession(id),
                dices = [dice(), dice(), dice(), dice(), dice()];
            
            sendMessage(id, "Dices: " + dices.join(" | "));
            
            session.dices = dices;
            --session.rollsRemaining;
            
            return dices;
        }
        
        function generateState(src) {
            var session = getSession(src),
                fields = [],
                counter = 0,
                i;
            
            sendMessage(src, "");
            
            sendMessage(src, "Score: " + session.score);
            sendMessage(src, "Rolls remaining: " + session.rollsRemaining);
            
            sendMessage(src, "");
            sendMessage(src, "Fields remaining:");
            
            for (i in session.fields) {
                if (session.fields[i] === false) {
                    fields.push(i);
                }
            }
            
            sendMessage(src, fields.join(" | "));
            sendMessage(src, "");
        }
        
        function checkDice(src) {
            var session = getSession(src),
                selectedDices = session.selectedDices,
                selectedField = session.selectedField,
                num = 0,
                numsHad = [],
                dicesHad = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0},
                trio = -1,
                duo = -1,
                i;
            
            switch (selectedField) {
            case '1 1 1':
                if (selectedDices.join(",") === "1,1,1") {
                    session.score += 3;
                    return true;
                }
                    
                return false;
            case '2 2 2':
                if (selectedDices.join(",") === "2,2,2") {
                    session.score += 6;
                    return true;
                }
                    
                return false;
            case '3 3 3':
                if (selectedDices.join(",") === "3,3,3") {
                    session.score += 9;
                    return true;
                }
                    
                return false;
            case '4 4 4':
                if (selectedDices.join(",") === "4,4,4") {
                    session.score += 12;
                    return true;
                }
                    
                return false;
            case '5 5 5':
                if (selectedDices.join(",") === "5,5,5") {
                    session.score += 15;
                    return true;
                }
                    
                return false;
            case '6 6 6':
                if (selectedDices.join(",") === "6,6,6") {
                    session.score += 18;
                    return true;
                }
                    
                return false;
            case 'One Pair':
                if (selectedDices.length !== 2) {
                    return false;
                }
                    
                selectedDices.forEach(function (dice) {
                    if (num === -1) {
                        return;
                    }
                    
                    if (num === 0) {
                        num = dice;
                    } else {
                        num = (dice === num ? dice : -1);
                    }
                });
                    
                if (num !== -1) {
                    session.score += 10;
                    return true;
                }
                return false;
            case 'All Different':
                selectedDices.forEach(function (dice) {
                    if (num === -1) {
                        return;
                    }
                    
                    numsHad.forEach(function (it) {
                        if (it === dice) {
                            num = -1;
                        }
                    });
                    
                    numsHad.push(dice);
                });
                    
                if (num !== -1) {
                    session.score += 10;
                    return true;
                }
                return false;
            case 'Full House':
                if (selectedDices.length !== 5) {
                    return false;
                }
                    
                selectedDices.forEach(function (dice) {
                    ++dicesHad[dice];
                });
                
                for (i in dicesHad) {
                    if (dicesHad[i] !== 2 || dicesHad[i] !== 3) {
                        return false;
                    }
                    
                    if (dicesHad[i] === 2) {
                        if (duo !== -1) {
                            return false;
                        }
                        
                        duo = i;
                    } else {
                        trio = i;
                    }
                }
                
                if (duo === -1 || trio === -1) {
                    return false;
                }
                    
                session.score += 50;
                return true;
            case 'Any Combo':
                session.score += 30;
                return true;
            case '4 Of A Kind':
                if (selectedDices.length !== 4) {
                    return false;
                }
                    
                selectedDices.forEach(function (dice) {
                    if (num === -1) {
                        return;
                    }
                    
                    if (num === 0) {
                        num = dice;
                    } else {
                        num = (dice === num ? dice : -1);
                    }
                });
                    
                if (num !== -1) {
                    session.score += 75;
                    return true;
                }
                
                return false;
            case '5 Of A Kind':
                if (selectedDices.length !== 5) {
                    return false;
                }
                    
                selectedDices.forEach(function (dice) {
                    if (num === -1) {
                        return;
                    }
                    
                    if (num === 0) {
                        num = dice;
                    } else {
                        num = (dice === num ? dice : -1);
                    }
                });
                    
                if (num !== -1) {
                    session.score += 100;
                    return true;
                }
                
                return false;
            }
        }
        
        commands["ds-play"] = function (src, commandData) {
            var session = getSession(src);
            
            if (session.state !== 'not-playing') {
                sendMessage(src, "You are already playing Dice Slider, " + sys.name(src) + "!");
                return;
            }
            
            session.state = 'playing';
            generateState(src);
            
            sendMessage(src, "Make a choice for your field with '/ds-field [name]'.");
            session.state = 'selecting-field';
        };
        
        commands["ds-field"] = function (src, commandData) {
            var session = getSession(src),
                fieldName = commandData.toLowerCase(),
                i;
            
            if (session.state === 'not-playing') {
                sendMessage(src, "You are not playing Dice Slider, " + sys.name(src) + "! Type '/ds-play' to play!");
                return;
            }
            
            if (session.state !== 'selecting-field') {
                sendMessage(src, "Now is not the time to select your field, " + sys.name(src) + "!");
                return;
            }
            
            sendMessage(src, "");
            
            for (i in session.fields) {
                if (i.toLowerCase() === fieldName) {
                    if (session.fields[i] === true) {
                        sendMessage(src, 'You have already completed the ' + i + ' field, ' + sys.name(src) + '! Please select another.');
                        return;
                    }
                    
                    sendMessage(src, 'Field selected: ' + i);
                    session.selectedField = i;
                    break;
                }
            }

            if (!session.selectedField) {
                sendMessage(src, "No field called '" + commandData + "' exists, " + sys.name(src) + "!");
                return;
            }
            
            rollDice(src);
            sendMessage(src, "Type '/ds-select [dices,dices2]' to select your dices (they go by index). For example, '/ds-select 1,2' would select your first and second dice. If you don't want any of these dices, type '/ds-select none' (will cause a re-roll).");
            
            session.state = 'selecting-dices';
        };
        
        commands["ds-select"] = function (src, commandData) {
            var session = getSession(src),
                dices = commandData.split(','),
                fieldsRemaining = false,
                validDices = 0,
                len,
                i;
            
            if (session.state === 'not-playing') {
                sendMessage(src, "You are not playing Dice Slider, " + sys.name(src) + "! Type '/ds-play' to play!");
                return;
            }
            
            sendMessage(src, "");
            
            if (session.state !== 'selecting-dices') {
                sendMessage(src, "Now is not the time to select your dices, " + sys.name(src) + "!");
                return;
            }
            
            if (commandData.toLowerCase() === "none") {
                // no <=
                if (session.rollsRemaining < 0) {
                    sendMessage(src, "You have no re-rolls remaining, " + sys.name(src) + ". Type '/ds-quit' if you can't make a move.");
                    return;
                }
                
                sendMessage(src, "Re-rolling your dice, " + sys.name(src) + "!");
                generateState(src);
                
                rollDice(src);
                sendMessage(src, "Type '/ds-select [dices,dices2]' to select your dices (they go by index). For example, '/ds-select 1,2' would select your first and second dice. If you don't want any of these dices, type '/ds-select none' (will cause a re-roll).");
                return;
            }
            
            if (dices.length === 0) {
                sendMessage(src, "You must specify one or multiple dices, " + sys.name(src) + "! For example, '/ds-select 1,2'.");
                return;
            }
            
            dices.forEach(function (value, index, array) {
                var num = +value;
                
                if (isNaN(num)) {
                    sendMessage(src, "Selection " + (index + 1) + " (" + num + ") is not a number.");
                    return;
                }
                
                if (num < 1 || num > 5) {
                    sendMessage(src, "Selection " + (index + 1) + " (" + num + ") must be 1-5.");
                    return;
                }
                
                if (session.selectedDices.length >= 5) {
                    sendMessage(src, "You may not select more than 5 dices, " + sys.name(src) + ".");
                    return;
                }
                
                ++validDices;
                session.selectedDices.push(session.dices[num - 1]);
            });
            
            if (validDices === 0) {
                sendMessage(src, 'No dices were considered valid, ' + sys.name(src) + '.');
                return;
            }
            
            sendMessage(src, "Selected dices: " + session.selectedDices.join(" | "));
            
            if (checkDice(src)) {
                session.fields[session.selectedField] = true;
                
                for (i in session.fields) {
                    if (session.fields[i] === false) {
                        fieldsRemaining = true;
                        break;
                    }
                }
                
                // Reset their fields.
                if (!fieldsRemaining) {
                    for (i = 0, len = fields.length; i < len; ++i) {
                        session.fields[fields[i]] = false;
                    }
                }
                
                resetVariables(src);
                
                sendMessage(src, "");
                sendMessage(src, 'Congratulations!');
                
                generateState(src);
                
                sendMessage(src, "Make a choice for your field with '/ds-field [name]'.");
                session.state = 'selecting-field';
            } else {
                // >= 0 is right here.
                if (session.rollsRemaining >= 0) {
                    commands["ds-select"](src, "none");
                } else {
                    sendMessage(src, 'Aww, bummer. :(');
                    commands["ds-quit"](src, commandData);
                }
            }
        };
        
        commands["ds-quit"] = function (src, commandData) {
            var session = getSession(src);
            
            if (session.state === 'not-playing') {
                sendMessage(src, "You are not playing Dice Slider, " + sys.name(src) + "!");
                return;
            }
            
            sendMessage(src, "");
            sendMessage(src, "Thanks for playing, " + sys.name(src) + "!");
            awardCoins(src);
            
            // reset their object
            init(src);
        };
        
        commands["ds-help"] = function (src, commandData) {
            var commandHelp = [
                "",
                "*** Dice Slider Commands ***",
                "ds [commandName] [arguments]: Runs the Dice Slider command, [commandName] with arguments [arguments]. E.G. '/ds select 1,2'.",
                "ds-play: Starts a game of Dice Slider. E.G. '/ds-play'.",
                "ds-field [fieldName]: Selects the field, [fieldName]. You must have started a game of Dice Slider before you can use this command. E.G. '/ds-field 2 2 2'.",
                "ds-select [dice],[dice],[etc]: Selects the given dices, separated with ',' (with no space inbetween). You must have started a game of Dice Slider before you can use this command. E.G. '/ds-select 1,2,4'.",
                "ds-quit: Stops a game of Dice Slider. You must have started a game of Dice Slider before you can use this command. E.G. '/ds-quit'.",
                "ds-help: Shows this message. E.G. '/ds-help'.",
                ""
            ];
            
            commandHelp.forEach(function (msg) {
                sys.sendMessage(src, msg, casino.chan);
            });
            
            sendMessage(src, "This game is based on http://games.yahoo.com/help/rules/dc&ss=1 . It's worth checking that out.");
        };
        
        commands.ds = function (src, commandData) {
            var mcmd = commandData.split(" ");
            
            if (mcmd[0] !== "ds") {
                if (commands.hasOwnProperty("ds-" + mcmd[0])) {
                    commands["ds-" + mcmd[0]](src, mcmd.slice(1).join(" "));
                    return true;
                }
                
                sendMessage(src, mcmd[0] + " is not a valid command, " + sys.name(src) + "!");
                return true;
            }
            
            sendMessage(src, "You can't call this command with itself, " + sys.name(src) + "!");
            return true;
        };
        
        return commands;
    }
    
    module.exports = DiceSlider;
}());
