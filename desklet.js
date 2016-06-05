/* vim: set ts=4 shiftwidth=4 expandtab: */

"use strict"; // default for cjs, but why not

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

        this.settings = new Settings.DeskletSettings(this, this.metadata.uuid, desklet_id);

        this.settings.bindProperty(Settings.BindingDirection.IN, "username", "username", this.updateStreams, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "timertime", "timertime", ()=>{}, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "shouldNotify", "shouldNotify", null, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "apikey", "apikey", null, null);

        this.soup = new Soup.SessionAsync();
        this.labels = [];
        this.streams = [];

        this.initUI();
        this.updateStreams();
    },

    on_desklet_removed: function() {
       Mainloop.source_remove(this.timer);
    },

    create_get_msg: function (url) {
        let msg = Soup.Message.new("GET", url);
        msg.request_headers.append("Client-ID", this.apikey);
        msg.request_headers.append("Accept", "application/vnd.twitchtv.3+json");
        return msg;
    },

    updateUI: function () {
        this.title.set_text("online streams for " + this.username);
        this.labels.forEach(label => {
            this.window.remove_actor(label);
        });
        this.labels = [];

        if (this.streams.length === 0) {
            let lbl = new St.Label();
            lbl.set_text("nothing here :(");
            this.window.add_actor(lbl);
            this.labels.push(lbl);
        }
        else {
            this.streams.forEach(streamer => {
                let lbl = new St.Label();
                lbl.set_text(streamer.name + " playing " + streamer.game);
                this.window.add_actor(lbl);
                this.labels.push(lbl);
            });
        }
    },

    updateStreams: function () {
        Mainloop.source_remove(this.timer);

        let localUsername = this.username; // to prevent async responses from creating labels for usernames that have been changed
                                           // this is unfortunately necessary because cinnamon doesn't wait for the user to finish inputting text into a entry.

        let res = this.create_get_msg("https://api.twitch.tv/kraken/users/" + localUsername + "/follows/channels");
        this.soup.queue_message(res, (session, message) => {
            if (message.status_code !== 200) {
                return;
            }

            let follows = [];
            let j = JSON.parse(message.response_body.data);
            j.follows.forEach(follow => {
                follows.push(follow.channel.name);
            });

            let url = "https://api.twitch.tv/kraken/streams?stream_type=live&channel=" + follows.join(",");
            let msg = this.create_get_msg(url);
            this.soup.queue_message(msg, (session, message) => {
                if (message.status_code !== 200) {
                    return;
                }
                let k = JSON.parse(message.response_body.data);
                let newStreams = [];
                let notifyList = [];
                k.streams.forEach(stream => {
                    let name = stream.channel.name;
                    if (!this.streams.find(function (element) {
                        return element.name === name;
                    }) && this.shouldNotify) {
                        // this is the weirdest identing ever
                        notifyList.push({"name": name, "game": stream.game});
                    }
                    newStreams.push({"name": name, "game": stream.game});
                });

                this.notifyOnline(notifyList);
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

    notifyOnline: function (streams) {
        let notify = function (title, body, icon) {
            // These APIs are (un)documented here:
            // https://github.com/linuxmint/Cinnamon/blob/master/js/ui/messageTray.js
            // https://github.com/linuxmint/Cinnamon/blob/master/js/ui/main.js
            // I reimplemented imports.ui.main.notify because the so-called "details" argument gets passed as the banner argument
            // to imports.ui.messageTray
            let source = new imports.ui.messageTray.SystemNotificationSource();
            imports.ui.main.messageTray.add(source);
            let notif = new imports.ui.messageTray.Notification(source, title, "" /* banner */, {"icon": icon, "body": body});
            notif.setTransient(false);
            source.notify(notif);
        };

        if (streams.length > 1) {
            let body = [];
            streams.forEach(stream => {
                body.push(stream.name + " is streaming " + stream.game);
            });
            notify("The following channels are streaming:", body.join("\n"), null);
        }
        else if (streams.length === 1) {
            let name = streams[0].name,
                game = streams[0].game;
            notify(name + " is streaming!", name + " is streaming " + game, null);
        }
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
