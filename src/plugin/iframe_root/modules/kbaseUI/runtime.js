define(['bluebird', 'kb_lib/props', 'kb_lib/messenger', './widget/manager', './session'], (
    Promise,
    props,
    Messenger,
    WidgetManager,
    Session
) => {
    'use strict';

    class Runtime {
        constructor({ token, username, config }) {
            this.token = token;
            this.username = username;
            this.widgetManager = new WidgetManager({
                baseWidgetConfig: {
                    runtime: this
                }
            });

            this.configDb = new props.Props({ data: config });

            this.pluginPath = '/modules/plugins/auth2-client/iframe_root';
            this.pluginResourcePath = this.pluginPath + '/resources';

            this.messenger = new Messenger();

            this.heartbeatTimer = null;

            this.services = {
                session: new Session({ runtime: this })
            };

            this.featureSwitches = {};
            this.configDb.getItem('ui.featureSwitches.available', []).forEach((featureSwitch) => {
                this.featureSwitches[featureSwitch.id] = featureSwitch;
            });
        }

        config(path, defaultValue) {
            return this.configDb.getItem(path, defaultValue);
        }

        getConfig(path, defaultValue) {
            return this.config(path, defaultValue);
        }

        service(name) {
            switch (name) {
            case 'session':
                return this.services.session;
            }
        }

        getService(name) {
            return this.service(name);
        }

        // COMM

        send(channel, message, data) {
            this.messenger.send({ channel, message, data });
        }

        receive(channel, message, handler) {
            return this.messenger.receive({ channel, message, handler });
        }

        recv(channel, message, handler) {
            return this.receive(channel, message, handler);
        }

        drop(subscription) {
            this.messenger.unreceive(subscription);
        }

        // FEATURE SWITCHES

        featureEnabled(id, defaultValue = false) {
            const featureSwitch = this.featureSwitches[id];
            if (!featureSwitch) {
                throw new Error('Feature switch "' + id + '" not defined');
            }

            const enabledFeatureSwitches = this.configDb.getItem('ui.featureSwitches.enabled');
            const enabled = enabledFeatureSwitches.includes(id);
            return enabled || defaultValue;
        }

        // LIFECYCLE

        start() {
            return Promise.try(() => {
                this.heartbeatTimer = window.setInterval(() => {
                    this.send('app', 'heartbeat', { time: new Date().getTime() });
                }, 1000);
                return this.services.session.start();
            });
        }

        stop() {
            return Promise.try(() => {
                window.clearInterval(this.heartbeatTimer);

                return this.services.session.stop();
            });
        }
    }

    return Runtime;
});
