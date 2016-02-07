/* vim: set ts=4 shiftwidth=4 expandtab: */
const Desklet = imports.ui.desklet;
const Settings = imports.ui.settings;
const St = imports.gi.St;
const Soup = imports.gi.Soup;
const Mainloop = imports.mainloop;


function ThingyDesklet(metadata, desklet_id) {
    this._init(metadata, desklet_id);
}

ThingyDesklet.prototype = {
    __proto__: Desklet.Desklet.prototype,

    _init: function(metadata, desklet_id) {
        Desklet.Desklet.prototype._init.call(this, metadata, desklet_id);

        this.settings = new Settings.DeskletSettings(this, this.metadata["uuid"], desklet_id);

        this.settings.bindProperty(Settings.BindingDirection.IN, "username", "username", this.updateStreams, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "timertime", "timertime", ()=>{}, null);

        this.soup = new Soup.SessionAsync();
        this.labels = [];
        this.streams = [];

        this.initUI();
        this.updateStreams();
    },

    on_desklet_removed: function() {
       Mainloop.source_remove(this.timer);
    },

    updateUI: function () {
        this.title.set_text("online streams for " + this.username);
        this.labels.forEach(label => {
            this.window.remove_actor(label);
        });
        this.labels = [];

        this.streams.forEach(streamer => {
            let lbl = new St.Label();
            lbl.set_text(streamer.name + " playing " + streamer.game);
            this.window.add_actor(lbl);
            this.labels.push(lbl);
        });
    },

    updateStreams: function () {
        Mainloop.source_remove(this.timer);

        let localUsername = this.username; // to prevent async responses from creating labels for usernames that have been changed
                                           // this is unfortunately necessary because cinnamon doesn't wait for the user to finish inputting text into a entry.

        let res = Soup.Message.new("GET", "https://api.twitch.tv/kraken/users/" + localUsername + "/follows/channels");
        this.soup.queue_message(res, (session, message) => {
            if (message.status_code !== 200) {
                return;
            }

            let follows = [];
            let j = JSON.parse(message.response_body.data);
            j.follows.forEach( follow => {
                follows.push(follow.channel.name);
            });

            let url = "https://api.twitch.tv/kraken/streams?stream_type=live&channel=" + follows.join(",");
            let msg = Soup.Message.new("GET", url);
            this.soup.queue_message(msg, (session, message) => {
                if (message.status_code !== 200) {
                    return;             
                }
                let k = JSON.parse(message.response_body.data);
                let newStreams = [];
                k.streams.forEach(stream => {
                    let name = stream.channel.name
                    if(!this.streams.find(function (element) {
                        return element.name === name; 
                    })) {
                        // this is the weirdest identing ever
                        this.notifyOnline(name);
                    }
                    newStreams.push({"name": name, "game": stream.game});
                });
                this.streams = newStreams;
                this.updateUI();
            });
        });
        this.timer = Mainloop.timeout_add_seconds(this.timertime, this.updateStreams.bind(this));
    },

    initUI: function() {
        this.window = new St.BoxLayout({vertical: true});
        this.title = new St.Label();
        this.title.set_text("starting up...");

        this.window.add_actor(this.title);
        this.setContent(this.window);

        this._menu.addAction("Force refresh", () => {
            this.updateStreams();
        });
    },

    notifyOnline: function (name) {
        // this will someday use the libnotify bindings for cjs
        global.log(name + " is online!");
    }
}

function main(metadata, desklet_id) {
    return new ThingyDesklet(metadata, desklet_id);
}

// polyfill for Array.prototype.find, from the MDN

if (!Array.prototype.find) {
  Array.prototype.find = function(predicate) {
    if (this === null) {
      throw new TypeError('Array.prototype.find called on null or undefined');
    }
    if (typeof predicate !== 'function') {
      throw new TypeError('predicate must be a function');
    }
    var list = Object(this);
    var length = list.length >>> 0;
    var thisArg = arguments[1];
    var value;

    for (var i = 0; i < length; i++) {
      value = list[i];
      if (predicate.call(thisArg, value, i, list)) {
        return value;
      }
    }
    return undefined;
  };
}
