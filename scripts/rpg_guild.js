// Global variables inherited from scripts.js
/*global rpgbot, sys, SESSION, exports*/
function Guild(name, data, rpg) {
    this.game = rpg;
    if (data.isNew) {
        var player = data.player, 
            owner = data.player.name.toLowerCase();
            
        data.level = 1;
        data.exp = 0;
        data.leader = owner;
        data.message = "Welcome, member of the " + name + " Guild!";
        
        data.members = {};
        data.membersInfo = {};
        data.expShare = {};
        data.expGiven = {};
        data.titles = {};
        
        data.members[owner] = player.id;
        data.membersInfo[owner] = {
            name: player.name,
            level: player.level, 
            job: player.job, 
            canInvite: true, 
            canKick: true, 
            canSetMessage: true, 
            canSetTitle: true, 
            canSetShare: true,
            canStoreBank: true,
            canWithdrawBank: true,
            canStoreStorage: true,
            canWithdrawStorage: true
        };
        data.expShare[owner] = 0;
        data.expGiven[owner] = 0;
        data.titles[owner] = "Guild Master";
        
        data.bank = 0;
        data.storage = {};
        data.bankLog = [];
        data.storageLog = [];
        
        data.invites = {};
        
        data.allies = {};
        data.rivals = {};
        
        data.levelUpDate = new Date().getTime();
    } 
    
    this.name = name;
    this.level = data.level;
    this.exp = data.exp;
    this.leader = data.leader;
    this.message = data.message;
    
    this.members = data.members;
    this.membersInfo = data.membersInfo;
    this.expShare = data.expShare;
    this.expGiven = data.expGiven;
    this.titles = data.titles;
    
    this.bank = data.bank;
    this.storage = data.storage;
    this.bankLog = data.bankLog;
    this.storageLog = data.storageLog;
    this.invites = data.invites;
    this.memberLimit = rpg.guildInfo.baseMembers + (rpg.guildInfo.membersPerLevel * this.level);
    
    this.allies = data.allies;
    this.rivals = data.rivals;
    
    this.levelUpDate = data.levelUpDate;
    
    /* 
        "name": "Guild Name",
        "level": 1,
        "exp": 253,
        "leader": "player1",
        "members": {
            "player1": playerId,
            "player2": null
        },
        "membersInfo": {
            "player1": {
                level: level, 
                job: job, 
                canInvite: true, 
                canKick: true, 
                canSetMessage: true, 
                canSetTitle: true, 
                canSetShare: true
            },
            "player2": {
                level: level, 
                job: job, 
                canInvite: true, 
                canKick: true, 
                canSetMessage: true, 
                canSetTitle: true, 
                canSetShare: true
            },
        },
        "storage": {
            "potion": 3
        },
        "bank": 350,
        "expShare": {
            "player1": 0.3,
            "player2": 0
        },
        "expGiven": {
            "player1": 220,
            "player2": 33
        },
        "titles": {
            "player1": "Grand Boss",
            "player2": "Minion"
        },
        "message": "We are going to hunt bosses tomorrow.",
        "storageLog": [],
        "bankLog": [],
        "invites": {
            "player3": true
        }
    */
}

Guild.prototype.useCommand = function(src, data) {
    var command = data, 
        info = "*";
    
    if (data.indexOf(":") !== -1) {
        command = data.substring(0, data.indexOf(":"));
        info = data.substr(data.indexOf(":") + 1);
    } else if (data.indexOf(" ") !== -1) {
        command = data.substring(0, data.indexOf(" "));
        info = data.substr(data.indexOf(" ") + 1);
    }
    
    switch (command.toLowerCase()) {
        case "invite":
        case "i":
            this.sendInvite(src, info);
        break;
        case "kick":
        case "k":
            this.kickPlayer(src, info);
        break;
        case "leave":
        case "l":
            this.leaveGuild(src);
        break;
        case "message":
        case "m":
            this.setGuildMessage(src, info);
        break;
        case "title":
        case "t":
            this.setTitle(src, info);
        break;
        case "exp":
            this.setExpShare(src, info);
        break;
        case "auth":
            this.setAuth(src, info);
        break;
        case "disband":
            this.disbandGuild(src, info);
        break;
        default:
            this.viewGuild(src);
    }
};
Guild.prototype.giveExp = function(player, exp) {
    var name = player.name.toLowerCase(), 
        table = this.game.guildInfo.exp,
        e;
    
    this.exp += exp;
    this.expGiven[name] += exp;
    
    if (this.exp > table[table.length-1]) {
        this.exp = table[table.length-1];
    }
    
    for (e = table.length; e >= 0; --e) {
        if (this.exp >= table[e - 1]) {
            e = e + 1;
            break;
        }
    }
    
    if (e > this.level) {
        this.broadcast("Guild's Level increased from " + this.level + " to " + e + "!", null, null);
        
        this.level = e;
        this.memberLimit = this.game.guildInfo.baseMembers + (this.game.guildInfo.membersPerLevel * this.level);
        this.levelUpDate = new Date().getTime();
    } 
};
Guild.prototype.useStorage = function(src, item, amount) {
    if (info == "*") {
        this.botMessage(src, "The Guild currently has the following items stored:", true);
        this.game.viewItems(src, "all", true);
        return;
    }
    
    if (!(item in this.game.items)) {
        this.botMessage(src, "Invalid Formatting! Choose a valid item!", true);
        return;
    }
    if (isNaN(amount)) {
        this.botMessage(src, "Invalid Formatting! Choose a valid number!", true);
        return;
    }
    
    var player = this.getAvatar(src), obj = this.game.items[item];
    if (amount > 0) {
        if (this.game.hasItem(player, item, amount)) {
            this.game.changeItemCount(player, item, -amount);
            
            if (!(item in this.storage)) {
                this.storage[item] = 0;
            }
            this.storage[item] += amount;
            
            this.game.saveGame(src, "sure");
            this.broadcast(player.name + " deposited " + amount + " " + obj.name + "(s) to the Guild's Storage!", null, null);
            this.storageLog.push("[" + (new Date().toUTCString()) + "] " + player.name + " deposited " + amount + " " + obj.name + "(s).");
        } else {
            this.botMessage(src, "You don't have " + amount + " " + obj.name + "(s) to store!", true);
        }
    } else if (amount < 0) {
        amount *= -1;
        if (item in this.storage && this.storage[item] >= amount) {
            this.game.changeItemCount(player, item, amount);
            this.storage[item] -= amount;
            if (this.storage[item] <= 0) {
                delete this.storage[item];
            }
            
            this.game.saveGame(src, "sure");
            this.broadcast(player.name + " withdrew " + amount + " " + obj.name + "(s) from the Guild's Storage!", null, null);
            this.storageLog.push("[" + (new Date().toUTCString()) + "] " + player.name + " withdrew " + amount + " " + obj.name + "(s).");
        } else {
            this.botMessage(src, "The Guilds doesn't have " + amount + " " + obj.name + "(s) stored!", true);
        }
    }
};
Guild.prototype.useBank = function(src, info) {
    if (info == "*") {
        this.botMessage(src, "The Guild currently has " + this.bank + " Gold stored.", true);
        return;
    }
    
    var amount = parseInt(info, 10);
    if (isNaN(amount)) {
        this.botMessage(src, "Invalid Amount!", true);
        return;
    }
    
    var player = this.getAvatar(src);
    if (amount > 0) {
        if (player.gold >= amount) {
            player.gold -= amount;
            this.bank += amount;
            
            this.game.saveGame(src, "sure");
            this.broadcast(player.name + " deposited " + amount + " Gold to the Guild's Bank!", null, null);
            this.bankLog.push("[" + (new Date().toUTCString()) + "] " + player.name + " deposited " + amount + " Gold.");
        } else {
            this.botMessage(src, "You don't have that much Gold to store!", true);
        }
    } else if (amount < 0) {
        amount *= -1;
        if (this.bank >= amount) {
            player.gold += amount;
            this.bank -= amount;
            this.game.saveGame(src, "sure");
            this.broadcast(player.name + " withdrew " + amount + " Gold from the Guild's Bank!", null, null);
            this.bankLog.push("[" + (new Date().toUTCString()) + "] " + player.name + " withdrew " + amount + " Gold.");
        } else {
            this.botMessage(src, "The Guild doesn't have that much Gold stored!", true);
        }
    }
};
Guild.prototype.setGuildMessage = function(src, info) {
    var name = this.getAvatar(src).name.toLowerCase(),
        upperName = this.membersInfo[name].name;
    if (info === "*") {
        this.botMessage(src, "The current Guild Message is: ", true);
        this.botMessage(src, this.message, true);
    } else {
        if (this.membersInfo[name].canSetMessage === true) {
            this.message = info;
            this.botMessage(src, "You changed the Guild Message!", true);
            this.broadcast(upperName + " changed the Guild Message!", src, null);
            this.broadcast(this.message, null, null);
        } else {
            this.botMessage(src, "You don't have permission to change the Guild Message!", true);
        }
    }
};
Guild.prototype.sendInvite = function(src, target) {
    if (target === "*") {
        var out = ["Players invited to the Guild: "];
        for (var x in this.invites) {
            out.push(x);
        }
        sys.sendMessage(src, "", this.game.rpgchan);
        this.botMessage(src, out);
        sys.sendMessage(src, "", this.game.rpgchan);
    } else {
        if (sys.id(target) === undefined) {
            this.botMessage(src, "No such player!", true);
            return;
        }
        var targetPlayer = this.getAvatar(sys.id(target)),
            name = this.getAvatar(src).name.toLowerCase();
            
        if (this.membersInfo[name].canInvite !== true) {
            this.botMessage(src, "You don't have permission to invite players to the Guild!", true);
            return;
        }
        
        target = targetPlayer.name.toLowerCase();
        if (target in this.invites) {
            delete this.invites[target];
            this.botMessage(src, "The guild invitation to " + target + " was cancelled.", true);
        } else {
            if (targetPlayer === null || targetPlayer === undefined) {
                this.botMessage(src, "This person doesn't have a character!", true);
                return;
            }
            if (targetPlayer.guild !== null) {
                this.botMessage(src, "This person is already in a guild!.", true);
                return;
            }
            if (Object.keys(this.members).length + Object.keys(this.invites).length >= this.memberLimit) {
                this.botMessage(src, "The Guild can't have more than " + this.memberLimit + " members (including pending invitations)!", true);
                return;
            }
            this.invites[target] = true;
            this.botMessage(src, "Guild invitation sent to " + targetPlayer.name + ".", true);
            this.botMessage(sys.id(target), "You have been invited to the " + this.name + " guild. To join, type '/guild join:" + this.name + "'.");
        }
    }
};
Guild.prototype.acceptInvite = function(player) {
    if (player.name.toLowerCase() in this.invites) {
        this.addMember(player);
        delete this.invites[player.name.toLowerCase()];
        this.broadcast(player.name + " has joined the Guild!", null, null);
        this.botMessage(player.id, this.message, true);
    }
};
Guild.prototype.addMember = function(player) {
    var name = player.name.toLowerCase();
    
    player.guild = this.name.toLowerCase();
    
    this.members[name] = player.id;
    this.membersInfo[name] = {
        name: player.name,
        level: player.level, 
        job: player.job, 
        canInvite: false, 
        canKick: false, 
        canSetMessage: false, 
        canSetTitle: false, 
        canSetShare: false,
        canStoreBank: false,
        canWithdrawBank: false,
        canStoreStorage: false,
        canWithdrawStorage: false
    };
    this.titles[name] = "New Member";
    this.expShare[name] = 0;
    
    if (!(name in this.expGiven)) {
        this.expGiven[name] = 0;
    }
};
Guild.prototype.kickPlayer = function(src, target) {
    var name = this.getAvatar(src).name.toLowerCase();
    
    if (this.membersInfo[name].canKick !== true) {
        this.botMessage(src, "You don't have permission to kick players from the Guild!", true);
        return;
    }
    if (!(target.toLowerCase() in this.members)) {
        this.botMessage(src, "This person is not in the guild!", true);
        return;
    }
    if (target.toLowerCase() === this.leader) {
        this.botMessage(src, "You can't kick the Guild Leader!", true);
        return;
    }
    var targetName = this.members[target] !== null ? this.membersInfo[target].name : target;
    
    this.broadcast(targetName + " was kicked from the Guild by " + this.getAvatar(src).name + "!", null, null);
    this.removeMember(target.toLowerCase());
};
Guild.prototype.disbandGuild = function(src, info) {
    var player = this.getAvatar(src);
    
    if (player.name.toLowerCase() !== this.leader) {
        this.botMessage(src, "Only the Leader can disband the Guild!", true);
        return;
    }
    
    if (info.toLowerCase() !== "sure") {
        this.botMessage(src, "Are you sure you want to disband the Guild? This can't be undone! Type '/g disband:sure' if you wish to proceed.", true);
        return;
    }
    
    this.destroy();
    this.game.saveGame(src, "sure");
};
Guild.prototype.destroy = function() {
    this.broadcast("The Guild was destroyed!", null, null);
    
    for (var x in this.members) {
        this.removeMember(x);
    }
    delete this.game.guilds[this.name.toLowerCase()];
};
Guild.prototype.leaveGuild = function(src, silent) {
    var name = this.getAvatar(src).name;
    
    if (name.toLowerCase() === this.leader && silent !== true) {
        this.botMessage(src, "You are the Leader, you cannot leave! To leave the guild, you must change the leader or disband the guild!", true);
        return;
    }
    
    this.broadcast(name + " has left the Guild!", (silent === true ? src : null), null);
    this.removeMember(name.toLowerCase());
};
Guild.prototype.removeMember = function(name, clearExp) {
    if (this.members[name] !== null) {
        this.getAvatar(this.members[name]).guild = null;
    }
    
    delete this.members[name];
    delete this.membersInfo[name];
    delete this.titles[name];
    delete this.expShare[name];
    
    if (clearExp) {
        delete this.expGiven[name];
    }
};
Guild.prototype.setTitle = function(src, info) {
    var upperName = this.getAvatar(src).name,
        name = upperName.toLowerCase();
    
    if (info === "*") {
        this.botMessage(src, "Your current Guild Title is " + this.titles[name] + "!", true);
        return;
    }
    if (this.membersInfo[name].canSetTitle !== true) {
        this.botMessage(src, "You don't have permission to change players' title!", true);
        return;
    }
    var data = info.split(":");
    if (data.length < 2) {
        this.botMessage(src, "Wrong format! Use '/g title PlayerName:Title'.", true);
        return;
    }
    var target = data[0].toLowerCase(),
        title = data[1];
    
    if (!(target in this.members)) {
        this.botMessage(src, "This person is not in the guild!", true);
        return;
    }
    if (target.toLowerCase() === this.leader && name !== this.leader) {
        this.botMessage(src, "You can't change the Guild Leader's title!", true);
        return;
    }
    var targetName = this.members[target] !== null ? this.membersInfo[target].name : target;
    
    this.titles[target] = title;
    this.broadcast(upperName + " changed " + targetName + "'s title to " + title + "!", null, null);
};
Guild.prototype.setExpShare = function(src, info) {
    var name = this.getAvatar(src).name.toLowerCase();
    
    if (info === "*") {
        this.botMessage(src, "You currently give " + (this.expShare[name] * 100) + "% of your exp. points to the Guild!", true);
        return;
    }
    if (this.membersInfo[name].canSetTitle !== true) {
        this.botMessage(src, "You don't have permission to change players' exp. share!", true);
        return;
    }
    var data = info.split(":");
    if (data.length < 2) {
        this.botMessage(src, "Wrong format! Use '/g title PlayerName:Number'.", true);
        return;
    }
    var target = data[0].toLowerCase(),
        val = parseInt(data[1], 10);
    
    if (!(target in this.members)) {
        this.botMessage(src, "This person is not in the guild!", true);
        return;
    }
    if (target.toLowerCase() === this.leader && name !== this.leader) {
        this.botMessage(src, "You can't change the Guild Leader's exp. share!", true);
        return;
    }
    if (isNaN(val) || val < 0 || val > 50) {
        this.botMessage(src, "Invalid value for exp. share! You can only set a value between 0 and 50!", true);
        return;
    }
    var targetName = this.members[target] !== null ? this.membersInfo[target].name : target;
    this.expShare[target] = val/100;
    this.botMessage(src, "You set " + targetName + "'s exp. share to " + val + "%!", true);
    if (this.members[target] !== null) {
        this.botMessage(this.members[target], "Your exp. share was set to " + val + "%!", true);
    }
};
Guild.prototype.setAuth = function(src, info) {
    var name = this.getAvatar(src).name.toLowerCase();
    
    if (info === "*") {
        this.viewAuth(src);
        return;
    }
    if (name !== this.leader) {
        this.botMessage(src, "Only the Guild Leader can set permissions!", true);
        return;
    }
    var data = info.split(":");
    if (data.length < 3) {
        this.botMessage(src, "Wrong format! Use '/g auth PlayerName:Permission:[on/off]'.", true);
        return;
    }
    var target = data[0].toLowerCase(),
        type = data[1].toLowerCase(),
        hasPermission = data[2].toLowerCase() === "on" ? true : false,
        permission,
        act;
    
    if (!(target in this.members)) {
        this.botMessage(src, "This person is not in the guild!", true);
        return;
    }
    if (target.toLowerCase() === this.leader) {
        this.botMessage(src, "You can't change your own permissions!", true);
        return;
    }
    
    switch (type) {
        case "invite":
            permission = "canInvite";
            act = "invite members to the guild";
        break;
        case "kick":
            permission = "canKick";
            act = "kick members from the guild";
        break;
        case "message":
            permission = "canSetMessage";
            act = "change the guild message";
        break;
        case "title":
            permission = "canSetTitle";
            act = "change members' title";
        break;
        case "exp":
        case "share":
        case "exp share":
            permission = "canSetShare";
            act = "change members' exp. share";
        break;
        default:
            this.botMessage(src, "Invalid Permission! Valid permissions are 'invite', 'kick', 'message', 'title' and 'exp'.", true);
            return;
    }
    var targetName = this.members[target] !== null ? this.membersInfo[target].name : target;
    this.membersInfo[target][permission] = hasPermission;
    this.botMessage(src, targetName + " is now " + (hasPermission ? "allowed" : "unable") + " to " + act, true);
    if (this.members[target] !== null) {
        this.botMessage(this.members[target], "You are now " + (hasPermission ? "allowed" : "unable") + " to " + act, true);
    }
};
Guild.prototype.viewAuth = function(src, data) {
    var out = ["<table border='1' cellpadding='3' cellspacing='1'><tr><th>Player</th><th>Invite</th><th>Kick</th><th>Guild Message</th><th>Set Titles</th><th>Set Exp. Share</th></tr>"],
        x, 
        info;
    
    if (data && data in this.members) {
        info = this.membersInfo[data];
        out.push('<tr><td>' + info.name + '</td><td>' + toYesNo(info.canInvite) + '</td><td>' + toYesNo(info.canKick) + '</td><td>' + toYesNo(info.canSetMessage) + '</td><td>' + toYesNo(info.canSetTitle) + '</td><td>' + toYesNo(info.canSetShare) + '</td></tr>');
    } else {
        for (x in this.membersInfo) {
            info = this.membersInfo[x];
            out.push('<tr><td>' + info.name + '</td><td>' + toYesNo(info.canInvite) + '</td><td>' + toYesNo(info.canKick) + '</td><td>' + toYesNo(info.canSetMessage) + '</td><td>' + toYesNo(info.canSetTitle) + '</td><td>' + toYesNo(info.canSetShare) + '</td></tr>');
        }
    }
    
    sys.sendMessage(src, "", this.game.rpgchan);
    this.botMessage(src, "Guild Permissions: ", true);
    sys.sendHtmlMessage(src, out.join("") + "</table>", this.game.rpgchan);
    sys.sendMessage(src, "", this.game.rpgchan);
};
Guild.prototype.memberLogin = function(src) {
    var player = this.getAvatar(src);
    
    this.members[player.name.toLowerCase()] = src;
    this.broadcast(player.name + " is now on.", src, null);
    this.botMessage(src, this.message, true);
};
Guild.prototype.memberLogout = function(src) {
    var player = this.getAvatar(src);
    
    this.members[player.name.toLowerCase()] = null;
    this.broadcast(player.name + " is now off.", src, null);
};
Guild.prototype.updateMembers = function() {
    var playerson = sys.playerIds(), 
        user, 
        x, 
        att = this.game.rpgAtt;
        
    for (x = 0; x < playerson.length; ++x) {
        user = SESSION.users(playerson[x]);
        if (user && user[att] && user[att] !== null && user[att] !== undefined && user[att].name in this.members) {
            this.members[user[att].name] = playerson[x];
        }
    }
};
Guild.prototype.updateMembersInfo = function(player) {
    var name = player.name.toLowerCase();
    
    this.membersInfo[name].level = player.level;
    this.membersInfo[name].job = player.job;
};

Guild.prototype.viewGuild = function(src) {
    var table = this.game.guildInfo.exp,
        out = ["Guild Name: " + this.name + " (Lv." + this.level + ") | Leader: " + this.membersInfo[this.leader].name + " | Members: " + Object.keys(this.members).length + "/" + this.memberLimit + " | Exp: " + this.exp + "/" + (this.level === table.length + 1 ? table[table.length-1] : table[this.level - 1]), "", "Members: "], 
        x, 
        info;
    
    
    for (x in this.membersInfo) {
        info = this.membersInfo[x];
        out.push(info.name + " (Lv. " + info.level + " " + this.game.classes[info.job].name + "), " + this.titles[x] + (this.members[x] !== null ? " (at " + this.game.places[this.getAvatar(this.members[x]).location].name + ")" : "" ) + " - Exp. Contribution: " + this.expGiven[x] + "/" + this.exp + (this.exp > 0 ? " (" + (this.expGiven[x]/this.exp*100).toFixed(1) + "%)" : ""));
    }
    
    sys.sendMessage(src, "", this.game.rpgchan);
    this.botMessage(src, out);
    sys.sendMessage(src, "", this.game.rpgchan);
};
Guild.prototype.guildChat = function(src, msg) {
    this.broadcast(msg, null, sys.name(src));
};
Guild.prototype.broadcast = function(msg, exclude, name) {
    for (var x in this.members) {
        if (this.members[x] === null || (exclude && this.members[x] === exclude)) {
            continue;
        }
        if (!name) {
            rpgbot.sendMessage(this.members[x], "[Guild] " + msg, this.game.rpgchan);
        } else {
            sys.sendMessage(this.members[x], name + ": [Guild] " + msg, this.game.rpgchan);
        }
    }
};
Guild.prototype.botMessage = function(src, message, needsGuildTag) {
    if (typeof message === "string") {
        rpgbot.sendMessage(src, (needsGuildTag ? "[Guild] " : "" ) + message, this.game.rpgchan);
    } else {
        var tag = needsGuildTag ? "[Guild] " : "" ;
        for (var x in message) {
            rpgbot.sendMessage(src, tag + message[x], this.game.rpgchan);
        }
    }
};
Guild.prototype.getAvatar = function(src) {
    return SESSION.users(src)[this.game.rpgAtt];
};
Guild.prototype.updateContent = function(rpg) {
    this.game = rpg;
};
function toYesNo(attr) {
    return attr === true ? "Yes" : "No";
}

exports.Guild = Guild;
