/*jslint es5: true, evil: true, plusplus: true, sloppy: true, vars: true, undef: true*/
/*global module, require, sys, casinobot, Config*/

// implementing Texas Hold'em
module.exports = function (casino) {
    var cards = require('cards.js'),
        randUtils = require('rand-utils.js');
    
    cards.useArc4 = true; // change this if it lags too much
    cards.raiseLimit = 50; // limit for raising
    cards.bigBlind = 5; // price of the big blind
    cards.smallBlind = 3; // price of the small blind
    cards.roundLimit = 10; // amount of rounds per poker game
    
    var game = {},
        module_scope = this;
    
    var commands = {
        user: {
            joinp: function (src, data) {
                if (!casino.coins.hasOwnProperty(sys.name(src).toLowerCase())) {
                    casino.coins[sys.name(src).toLowerCase()] = 100;
                }
                if (casino.coins[sys.name(src).toLowerCase()] < 80) {
                    return send(src, "You need at least 80 coins to join a game of poker.");
                }
                if (game.state !== 'signup') {
                    return send(src, "You can't sign up right now. Try later.");
                }
                if (game.signups.indexOf(sys.name(src)) !== -1) {
                    return send(src, "You've already signed up.");
                }
                // exceptions can be made to this.
                if (game.ips.indexOf(sys.ip(src)) !== -1) {
                    return send(src, "Your IP has already signed up.");
                }
                
                game.signups.push(sys.name(src));
                game.ips.push(sys.ip(src));
                
                if (game.signups.length === 22) {
                    game.ticks = 0;
                }
                
                broadcast(sys.name(src) + " joined! " + game.ticks + " second(s) left!");
                
                if (game.ticks === 0) {
                    ++game.ticks;
                }
            },
            leave: function (src, data) {
                var name = sys.name(src),
                    msg = name + " left.",
                    i;
                
                if (game.state === 'none') {
                    return send(src, "No game has started.");
                }
                if (game.signups.indexOf(name) !== -1) {
                    return send(src, "You've never signed up.");
                }
                
                game.signups.splice(game.signups.indexOf(name), 1);
                game.ips.splice(game.ips.indexOf(sys.ip(src)), 1);
                                
                if (game.state === 'signup') {
                    msg += " " + game.ticks + " second(s) left.";
                } else {
                    if (name === (playerGet(game.currentPlayer) || {}).name) {
                        nextPlayer();
                    }
                }
                
                for (i in game.players) {
                    if (game.players.hasOwnProperty(i)) {
                        if (game.players[i].name === name) {
                            delete game.players[i];
                            break;
                        }
                    }
                }
                
                broadcast(msg);
            },
            cards: function (src, data) {
                var self;
                if (game.state !== 'started') {
                    return send(src, "The game hasn't even started yet.");
                }
                if ((self = game.players[sys.name(src).toLowerCase()]) === undefined) {
                    return send(src, "You never joined the game!");
                }
                
                send(src, "Your cards:");
                send(src, self.deck.cards.map(mapCards).join(" | "));
            },
            fold: function (src, data) {
                if (game.state !== '') {
                }
            }
        },
        mod: {
            start: function (src, data) {
                game.state = 'signup';
                game.nextState = gameStart;
                game.ticks = 90;
                
                broadcast(sys.name(src) + " started a game of Texas Hold'em Poker! Type /joinp to join (you have " + game.ticks + " seconds to join)!");
            },
            stop: function (src, data) {
                resetGame();
                broadcast(sys.name(src) + " stopped the game!");
            }
        }
    };
    
    function handleCommand(src, message, channel) {
        var command,
            commandData,
            pos = message.indexOf(' ');
        
        if (pos !== -1) {
            command = message.substring(0, pos).toLowerCase();
            commandData = message.substr(pos + 1);
        } else {
            command = message.substr(0).toLowerCase();
        }
        
        if (commands.user.hasOwnProperty(command)) {
            commands.user[command].call(module_scope, src, commandData);
            return true;
        }
        
        if (sys.auth(src) <= 0 || Config.casinoAdmins.indexOf(sys.name(src).toLowerCase()) === -1) {
            throw "invalid command";
        }
        
        if (commands.mod.hasOwnProperty(command)) {
            commands.mod[command].call(module_scope, src, commandData);
            return true;
        }
    }
    
    function broadcast(msg) {
        if (msg === "") {
            return sendChanAll("", casino.chan);
        }
        casinobot.sendAll(msg, casino.chan);
    }
    
    function send(src, msg) {
        casinobot.sendMessage(src, msg, casino.chan);
    }
    
    function playerSet(pos, property, value) {
        game.players[Object.keys(game.players)[pos]][property] = value;
    }
    
    function playerGet(pos) {
        return game.players[Object.keys(game.players)[pos]];
    }
    
    function resetGame() {
        var newGameObj = {
            players: {},
            signups: [],
            ips: [],
            deck: new cards.PokerDeck(),
            communityCards: new cards.Deck(),
            nextState: function () {},
            ticks: 0,
            round: 1,
            pot: sys.rand(10, 26),
            bet: cards.bigBlind,
            currentPlayer: 0,
            state: 'none'
        };
        
        game = newGameObj;
    }
    
    function newRound() {
        var i,
            player,
            nextPlayerGetsBigBlind,
            nextPlayerGetsSmallBlind;
        
        game.deck.shuffleAll();
        game.communityCards = new cards.Deck();
        game.bet = cards.bigBlind;
        game.currentPlayer = 0;
        ++game.round;
        
        for (i in game.players) {
            if (game.players.hasOwnProperty(i)) {
                player = game.players[i];
                
                player.deck = new cards.Deck();
                
                if (nextPlayerGetsSmallBlind) {
                    player.smallBlind = true;
                    player.bigBlind = false;
                    nextPlayerGetsSmallBlind = false;
                } else if (nextPlayerGetsBigBlind) {
                    nextPlayerGetsSmallBlind = true;
                    player.bigBlind = true;
                    player.smallBlind = false;
                    nextPlayerGetsBigBlind = false;
                } else if (player.bigBlind) {
                    nextPlayerGetsBigBlind = true;
                    player.bigBlind = false;
                    player.smallBlind = false;
                }
            }
        }
        
        if (nextPlayerGetsBigBlind) {
            playerSet(0, 'bigBlind', true);
            playerSet(1, 'smallBlind', true);
        } else if (nextPlayerGetsSmallBlind) {
            playerSet(0, 'smallBlind', true);
        }
        
        if (game.round === (cards.roundLimit + 1)) {
            broadcast("Stopping this game of poker: 10 rounds have been played.");
            broadcast("Ask a moderator to start another game.");
            return 'stop';
        }
        
        broadcast("");
        broadcast("Starting round #" + game.round + ".");
        broadcast("");
    }
     
    function gameStart() {
        randUtils.shuffle(game.signups, cards.useArc4 ? 'ARC4' : 'SIMPLE');
        
        game.ticks = -1;
        game.state = 'started';
        game.signups.forEach(function (player) {
            game.players[player.toLowerCase()] = {
                name: player,
                deck: new cards.Deck(),
                bigBlind: false,
                smallBlind: false
            };
        });
        
        playerSet(0, 'bigBlind', true);
        playerSet(1, 'smallBlind', true);
        gamestate_start();
    }
    
    function mapCards(card) {
        return card.unicodeString();
    }
    
    function step() {
        --game.ticks;
        
        if (game.ticks === 0) {
            game.nextState();
        }
    }
    
    resetGame();
    
    // game states
    function gamestate_start() {
        var x,
            i,
            player,
            bigBlind,
            smallBlind;
        
        for (x = 0; x < 2; ++x) {
            for (i in game.players) {
                if (game.players.hasOwnProperty(i)) {
                    player = game.players[i];
                    player.deck.add(game.deck.draw());
                    
                    if (player.bigBlind) {
                        bigBlind = player;
                    } else if (player.smallBlind) {
                        smallBlind = player;
                    }
                }
            }
        }
        
        casino.coins[bigBlind.name] -= cards.bigBlind;
        casino.coins[smallBlind.name] -= cards.smallBlind;
        
        broadcast("");
        broadcast("There are " + Object.keys(game.players).length + " players [" + game.signups.join(', ') + "].");
        broadcast(bigBlind.name + " has the big blind [" + cards.bigBlind + " coins].");
        broadcast(smallBlind.name + " has the small blind [" + cards.smallBlind + " coins].");
        broadcast("There are " + game.pot + " coins in the pot.");
        broadcast("The raise limit is " + cards.raiseLimit + ".");
        broadcast("");
        
        for (i in game.players) {
            if (game.players.hasOwnProperty(i)) {
                player = game.players[i];
                if (sys.id(player.name) !== undefined) {
                    send(sys.id(player.name), "You currently have " + casino.coins[player.name.toLowerCase()] + " coins.");
                    send(sys.id(player.name), "Your cards [type /cards to see them again]:");
                    send(sys.id(player.name), player.deck.cards.map(mapCards).join(" | "));
                }
            }
        }
        
        game.nextState = gamestate_preflop;
        game.nextState();
    }
    
    function gamestate_preflop() {
        broadcast("");
        broadcast("State: Pre-Flop");
        broadcast("It's " + playerGet(0).name + "'s turn.");
        broadcast("");
        
        turnHelp();
        game.nextState = gamestate_flop;
    }
    
    function gamestate_flop() {
        game.deck.draw(3).forEach(function (card) {
            game.communityCards.add(card);
        });
        
        broadcast("");
        broadcast("Community Cards:");
        broadcast(game.communityCards.cards.map(mapCards).join(" | "));
        broadcast("");
        broadcast("State: Flop");
        broadcast("It's " + playerGet(0).name + "'s turn.");
        broadcast("");
        
        turnHelp();
        game.nextState = gamestate_turn;
    }
    
    function gamestate_turn() {
        game.communityCards.add(game.deck.draw());
                
        broadcast("");
        broadcast("Community Cards:");
        broadcast(game.communityCards.cards.map(mapCards).join(" | "));
        broadcast("");
        broadcast("State: Turn");
        broadcast("It's " + playerGet(0).name + "'s turn.");
        broadcast("");
        
        turnHelp();
        game.nextState = gamestate_river;
    }
    
    function gamestate_river() {
        game.communityCards.add(game.deck.draw());
        
        broadcast("");
        broadcast("Community Cards:");
        broadcast(game.communityCards.cards.map(mapCards).join(" | "));
        broadcast("");
        broadcast("State: River");
        broadcast("It's " + playerGet(0).name + "'s turn.");
        broadcast("");
        
        turnHelp();
        game.nextState = gamestate_end;
    }
    
    function gamestate_end() {
        if (newRound() === 'stop') {
            return;
        }
        
        game.nextState = gamestate_start;
        game.nextState();
    }
    
    function nextPlayer() {
        broadcast("");
        broadcast(playerGet(game.currentPlayer).name + "'s turn ended.");
        
        ++game.currentPlayer;
        
        if (playerGet(game.currentPlayer) === undefined) {
            game.currentPlayer = 0;
            return game.nextState();
        }
        
        broadcast("It's " + playerGet(game.currentPlayer).name + "'s turn.");
        broadcast("");
    }
    
    function turnHelp() {
        var id = sys.id(playerGet(game.currentPlayer).name),
            actions = [];
        
        if (id === undefined || !sys.isInChannel(id, casino.chan)) {
            broadcast(playerGet(game.currentPlayer).name + " is not here..");
            return nextPlayer();
        }
        
        if (action) {
        }
        
        actions.push("Fold [/fold]");
        
        broadcast("Possible actions:");
        broadcast("Open [/open] | Call [/call] | Check [/check] | Raise [/raise] | Fold [/fold]");
    }
    
    return {
        handleCommand: function (src, message, channel) {
            try {
                return handleCommand(src, message, channel);
            } catch (e) {
                if (e !== "invalid command") {
                    broadcast("Error with poker command " + message.split(' ')[0] + ": " + e + " on " + e.lineNumber + ".");
                }
            }
        },
        step: step
    };
};