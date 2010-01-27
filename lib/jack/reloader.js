var Sandbox = require("sandbox").Sandbox;

exports.Reloader = function(id, appName) {
    appName = appName || 'app';
    return function(env) {
        var modules = {};
        try {
            // some wildfire modules need to be singletons and survive reloads
            modules["wildfire"] = require("wildfire");
            modules["wildfire/binding/jack"] = require("wildfire/binding/jack");
        } catch(e) {}
        var sandbox = Sandbox({
            "system": system,
            "loader": require.loader,
            "debug": require.loader.debug,
            "modules": modules
        });
        var module = sandbox(id); // not as main, key
        return module[appName](env);
    }
}
