/* vim: set ts=4 shiftwidth=4 expandtab: */
const Desklet = imports.ui.desklet;
const Settings = imports.ui.settings;
const St = imports.gi.St;
const Soup = imports.gi.Soup;


function ThingyDesklet(metadata, desklet_id) {
    this._init(metadata, desklet_id);
}


ThingyDesklet.prototype = {
    __proto__: Desklet.Desklet.prototype,
    
    soup: new Soup.SessionAsync(),

    _init: function(metadata, desklet_id) {
        Desklet.Desklet.prototype._init.call(this, metadata, 
desklet_id);

        this.settings = new Settings.DeskletSettings(this, this.metadata["uuid"], desklet_id);

        this.settings.bindProperty(Settings.BindingDirection.IN, "username", "username", function() {}, null);

        this.initUI();

        let res = Soup.Message.new("GET", "https://api.twitch.tv/kraken/users/"+ this.username +"/follows/channels");
        this.soup.queue_message(res, (session, message) => {
            if (message.status_code !== 200) {
                return;
            }
            let j = JSON.parse(message.response_body.data);
            j.follows.forEach(obj => {
                let stream = "https://api.twitch.tv/kraken/streams/" + obj.channel.name;
                let msg = Soup.Message.new("GET", stream);
                this.soup.queue_message(msg, (session, message) =>{
                    if (message.status_code !== 200) {
                        return;
                    }
                    let k = JSON.parse(message.response_body.data);
                    if (k.stream !== null) {
                        let lbl = new St.Label();
                        lbl.set_text(obj.channel.name + " online");
                        this.window.add_actor(lbl);
                    }
                });
            });
        });
    },

    initUI: function() {
        this.window = new St.BoxLayout({vertical: true});
        this.text = new St.Label();
        this.text.set_text("online subscriptions for " + this.username);

        this.window.add_actor(this.text);
        this.setContent(this.window);
    }
}

function main(metadata, desklet_id) {
    return new ThingyDesklet(metadata, desklet_id)
}
