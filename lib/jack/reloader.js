var Sandbox = require("sandbox").Sandbox;

exports.Reloader = function(id, appName, options) {
    appName = appName || 'app';
    options = options || {};
    return function(env) {
        var modules = options.modules || {};
        try {
            // some wildfire modules need to be singletons and survive reloads
            modules["wildfire"] = require("wildfire");
            modules["wildfire/binding/jack"] = require("wildfire/binding/jack");
        } catch(e) {}
        var sandbox = Sandbox({
            "system": system,
            modules: {
            	"event-loop": require("event-loop"),
            	"packages": require("packages")
            },
            "loader": require.loader,
            "debug": require.loader.debug,
            "modules": modules
        });
        var module = sandbox(id); // not as main, key
        return module[appName](env);
    }
}
