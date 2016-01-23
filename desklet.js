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
    
    soup: new Soup.SessionAsync(),

    labels: [],

    _init: function(metadata, desklet_id) {
        Desklet.Desklet.prototype._init.call(this, metadata, 
desklet_id);

        this.settings = new Settings.DeskletSettings(this, this.metadata["uuid"], desklet_id);

        this.settings.bindProperty(Settings.BindingDirection.IN, "username", "username", this.updateStreams, null);

        this.initUI();
        this.updateStreams();
    },

    on_desklet_removed: function() {
       Mainloop.source_remove(this.timer);
    },

    updateStreams: function() {
        // clear the desklet
        Mainloop.source_remove(this.timer);
        this.title.set_text("online streams for " + this.username);
        this.labels.forEach(label => {
            this.window.remove_actor(label);
        });

        let localUsername = this.username; // to prevent async responses from creating labels for usernames that have been changed
                                           // this is unfortunately necessary because cinnamon doesn't wait for the user to finish inputting text into a entry.

        let res = Soup.Message.new("GET", "https://api.twitch.tv/kraken/users/"+ localUsername +"/follows/channels");
        this.soup.queue_message(res, (session, message) => {
            if (message.status_code !== 200) {
                return;
            }
            let j = JSON.parse(message.response_body.data);
            j.follows.forEach(obj => {
                let stream = "https://api.twitch.tv/kraken/streams/" + obj.channel.name;
                let msg = Soup.Message.new("GET", stream);
                this.soup.queue_message(msg, (session, message) => {
                    if (message.status_code !== 200) {
                        return;
                    }
                    let k = JSON.parse(message.response_body.data);
                    if (k.stream !== null && localUsername === this.username) {
                        let lbl = new St.Label();
                        lbl.set_text(obj.channel.name + " online");
                        this.window.add_actor(lbl);
                        this.labels.push(lbl);
                    }
                });
            });
        });
        this.timer = Mainloop.timeout_add_seconds(600, this.updateStreams.bind(this));
    },

    initUI: function() {
        this.window = new St.BoxLayout({vertical: true});
        this.title = new St.Label();
        this.title.set_text("starting up...");

        this.window.add_actor(this.title);
        this.setContent(this.window);
    }
}

function main(metadata, desklet_id) {
    return new ThingyDesklet(metadata, desklet_id)
}
