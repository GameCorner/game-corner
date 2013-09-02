// Global variables inherited from scripts.js
/*global rpgbot, sys, SESSION, exports*/
function Party(src, data, rpg) {
    this.game = rpg;
    this.name = data;
    this.members = [src];
    this.invites = [];
    this.leader = src;
    
    this.getAvatar(src).party = this.name;
    
    sys.sendMessage(src, "", this.game.rpgchan);
    rpgbot.sendMessage(src, "You created a party! Use '/party invite:name' to recruit members!", this.game.rpgchan);
    rpgbot.sendMessage(src, "You can also use '/party kick' to remove a member, '/party leave' to quit your party and '/party disband' to break the party!", this.game.rpgchan);
    sys.sendMessage(src, "", this.game.rpgchan);
}
Party.prototype.getAvatar = function(src) {
    return SESSION.users(src)[this.game.rpgAtt];
};
Party.prototype.getTitlePlayer = function(player) {
    return (player.currentTitle !== null && player.currentTitle in this.game.titles ? this.game.titles[player.currentTitle].name + " " : "") + player.name;
};
Party.prototype.destroy = function(src) {
    if (this.isLeader(src)) {
        this.broadcast(sys.name(src) + " has disbanded the party!");
        
        for (var p = this.members.length - 1; p >= 0; --p) {
            this.leave(this.members[p], true);
        }
        
        if (this.name in this.game.currentParties) {
            delete this.game.currentParties[this.name];
        }
    }
};
Party.prototype.leave = function(src, silent) {
    if (this.members.indexOf(src) !== -1) {
        if (silent === false) {
            this.broadcast(sys.name(src) + " left the party!");
        }
        
        this.members.splice(this.members.indexOf(src), 1);
        this.getAvatar(src).party = null;
        
        if (silent === false) {
            this.fix();
        }
    }
    if (this.invites.indexOf(src) !== -1) {
        this.invites.splice(this.invites.indexOf(src), 1);
    }
    
};
Party.prototype.invite = function(src, target) {
    if (this.isLeader(src)) {
        if (sys.id(target) === undefined) {
            rpgbot.sendMessage(src, "No such person!", this.game.rpgchan);
            return;
        }
        var id = sys.id(target);
        if (this.getAvatar(id) === undefined) {
            rpgbot.sendMessage(src, "This person doesn't have a character!", this.game.rpgchan);
            return;
        }
        if (this.members.indexOf(id) !== -1) {
            rpgbot.sendMessage(src, "This person is already a member!", this.game.rpgchan);
            return;
        }
        if (this.invites.indexOf(id) !== -1) {
            rpgbot.sendMessage(src, "You removed the invite to " + sys.name(id) + "!", this.game.rpgchan);
            this.invites.splice(this.invites.indexOf(id), 1);
            return;
        }
        if (this.getAvatar(id).party) {
            rpgbot.sendMessage(src, "This person is already in another party!", this.game.rpgchan);
            return;
        }
        if (this.members.length >= this.game.battleSetup.party) {
            rpgbot.sendMessage(src, "The party is already full!", this.game.rpgchan);
            return;
        }
        this.invites.push(id);
        rpgbot.sendMessage(id, this.getTitlePlayer(this.getAvatar(src)) + " is inviting you to a party! To join, type /party join:" + this.name, this.game.rpgchan);
        rpgbot.sendMessage(src, "You invited " + sys.name(id) + " to the party!", this.game.rpgchan);
        
    }
};
Party.prototype.join = function(src) {
    if (this.invites.indexOf(src) !== -1) {
        if (this.members.length >= this.game.battleSetup.party) {
            rpgbot.sendMessage(src, "The party is already full!", this.game.rpgchan);
            return;
        }
        this.invites.splice(this.invites.indexOf(src), 1);
        this.members.push(src);
        this.getAvatar(src).party = this.name;
        this.broadcast(this.getTitlePlayer(this.getAvatar(src)) + " has joined the party!");
        this.fix();
    } else {
        rpgbot.sendMessage(src, "You haven't been invited to this party!", this.game.rpgchan);
    }
};
Party.prototype.kick = function(src, target) {
    if (this.isLeader(src)) {
        this.fix();
        if (sys.id(target) === undefined) {
            rpgbot.sendMessage(src, "No such person!", this.game.rpgchan);
            return;
        }
        var id = sys.id(target);
        if (this.members.indexOf(id) === -1) {
            rpgbot.sendMessage(src, "This person is not in your party!", this.game.rpgchan);
            return;
        }
        if (id === src) {
            rpgbot.sendMessage(src, "You can't kick yourself! Use /party leave if you wish to leave your party!", this.game.rpgchan);
            return;
        }
        this.broadcast(sys.name(src) + " kicked " + sys.name(id) + " from the party!");
        this.leave(id, true);
    }
};
Party.prototype.changeLeader = function(src, target) {
    if (this.isLeader(src)) {
        if (sys.id(target) === undefined) {
            rpgbot.sendMessage(src, "No such person!", this.game.rpgchan);
            return;
        }
        var id = sys.id(target);
        if (this.members.indexOf(id) === -1) {
            rpgbot.sendMessage(src, "This person is not in your party!", this.game.rpgchan);
            return;
        }
        if (id === src) {
            rpgbot.sendMessage(src, "You are already the leader!", this.game.rpgchan);
            return;
        }
        var index = this.members.indexOf(id);
        this.members.splice(index, 1);
        this.members.splice(0, 0, id);
        this.fix();
    }
};
Party.prototype.updateLeader = function() {
    if (this.leader !== this.members[0]) {
        this.leader = this.members[0];
        this.broadcast(sys.name(this.leader) + " is now the leader of the party!");
    }
};
Party.prototype.broadcast = function(msg, exclude, name) {
    for (var x in this.members) {
        if (exclude && this.members[x] === exclude) {
            continue;
        }
        if (!name) {
            rpgbot.sendMessage(this.members[x], "[Party] " + msg, this.game.rpgchan);
        } else {
            sys.sendMessage(this.members[x], name + ": [Party] " + msg, this.game.rpgchan);
        }
    }
};
Party.prototype.viewInfo = function(src) {
    this.fix();
    
    sys.sendMessage(src, "", this.game.rpgchan);
    rpgbot.sendMessage(src, "Your Party (" + this.name + "): ", this.game.rpgchan);
    for (var x = 0; x < this.members.length; ++x) {
        var player = this.getAvatar(this.members[x]);
        rpgbot.sendMessage(src, this.getTitlePlayer(player) + (x === 0 ? " (Leader)" : "") + " [" + this.game.classes[player.job].name + " Lv. " + player.level + ", at " + this.game.places[player.location].name + (player.hp === 0 ? " (Dead)" : "") + "]", this.game.rpgchan);
    }
    sys.sendMessage(src, "", this.game.rpgchan);
};
Party.prototype.isMember = function(src) {
    return this.members.indexOf(src) !== -1;
};
Party.prototype.isLeader = function(src) {
    if (this.leader === src) {
        return true;
    } else {
        rpgbot.sendMessage(src, "Only the Party Leader can use this command!", this.game.rpgchan);
        return false;
    }
};
Party.prototype.findMembersNear = function(src, noLevelDiff) {
    this.fix();
    
    var player = this.getAvatar(src);
    var loc = player.location;
    var battlers = [];
    var viewers = [];
    
    var id;
    var target;
    for (var p in this.members) {
        id = this.members[p];
        target = this.getAvatar(id);
        if (target.location === loc && target.isBattling === false && target.hp > 0 && (noLevelDiff === true || Math.abs(player.level - target.level) <= this.game.battleSetup.partyLevelDiff)) {
            battlers.push(target);
            viewers.push(id);
        }
    }
    
    return [viewers, battlers];
};
Party.prototype.fix = function() {
    var id;
    for (var p = this.members.length - 1; p >= 0; --p) {
        id = this.members[p];
        if (SESSION.users(id) === undefined || this.getAvatar(id) === undefined) {
            this.members.splice(p, 1);
        }
    }
    for (p = this.invites.length - 1; p >= 0; --p) {
        id = this.invites[p];
        if (SESSION.users(id) === undefined || this.getAvatar(id) === undefined) {
            this.invites.splice(p, 1);
        }
    }
    if (this.members.length > 0) {
        this.updateLeader();
    } else {
        if (this.name in this.game.currentParties) {
            delete this.game.currentParties[this.name];
        }
    }
};
Party.prototype.updateContent = function(rpg) {
    this.game = rpg;
};

exports.Party = Party;
