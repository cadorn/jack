
/**
 * Start a server with a jack app:
 * 
 *     var app = function(env)
 *     {
 *         return {
 *             status: 200,
 *             headers: {"Content-Type":"text/plain"},
 *             body:["Hello from " + env["SCRIPT_NAME"]]
 *         };
 *     }
 *     var options = {port: 8088};
 *     var server = require("jack/handler/xulrunner").start(app, options);
 * 
 * To stop the server:
 * 
 *     server.stop();
 */


var util = require("util");


exports.start = function(app, options) {
    var options = options || {},
        port = options["port"] || 8080;
        
    var server = new Server(app, port);

    server.start();

    return server;
}

var Server = function(app, port) {

    var socket = null;
    
    
    this.start = function() 
    {
        socket = Components.classes["@mozilla.org/network/server-socket;1"]
                   .createInstance(Components.interfaces.nsIServerSocket);
        socket.init(port, false, -1);
        socket.asyncListen(socketListener);
    };

    this.stop = function() 
    {
        if (socket)
            socket.close();
    };
    
    
    var socketListener = 
    {
        onSocketAccepted: function(socket, transport)
        {
            try
            {
                var input_stream = transport.openInputStream(transport.OPEN_UNBUFFERED,0,0);        
                var available = input_stream.available();
    
                var reader = Components.classes["@mozilla.org/intl/converter-input-stream;1"]
                               .createInstance(Components.interfaces.nsIConverterInputStream);
                reader.init(input_stream, "UTF-8", 1024, 0xFFFD);
    
                var str = {};
                var numChars = 1;
                var input_string ="";       
                while(numChars != 0) 
                {
                    numChars = reader.readString(1024, str);
                    input_string += str.value;             
                }

                // split request headers from request body
                var segments = input_string.split("\r\n\r\n");

                var env = {};
                var parts = null;
                
                var headers = segments[0].split("\r\n");
                
                // parse out request headers
                util.forEach(headers, function(header) {

                    if(!header)
                        return;
                    
                    if(!env["REQUEST_METHOD"] &&
                       (parts = regExec(/(GET|POST)\s(.+)\sHTTP\/([\d.]*)/ig,header))) {

                        env["REQUEST_METHOD"] = parts[1];
                        env["REQUEST_URI"] = parts[2];
                        env["SERVER_PROTOCOL"] = "HTTP/" + parts[3];
    
                    } else
                    if(parts = regExec(/(.*?):\s*(.*)/i,header)) {
                        
                        var key = parts[1].replace(/-/g, "_").toUpperCase();
                        var value = parts[2];
                        
                        if (key != "CONTENT_LENGTH" && key != "CONTENT_TYPE")
                            key = "HTTP_" + key;
                
                        env[key] = value;
                    } else {
                        print('ERROR reading header: '+ header);                            
                    }
                });

                parts = env["HTTP_HOST"].split(":");
                env["SERVER_NAME"] = parts[0];
                env["SERVER_PORT"] = parts[1];
                
                parts = regExec(/([^?]+)\??(.*)/i,env["REQUEST_URI"]);
                env["PATH_INFO"] = parts[1];
                env["QUERY_STRING"] = parts[2] || "";
                env["SCRIPT_NAME"] = "";

                env["jack.version"]         = [0,1];
                env["jack.input"]           = null; // FIXME
                env["jack.errors"]          = system.stderr;
                env["jack.multithread"]     = false;
                env["jack.multiprocess"]    = true;
                env["jack.run_once"]        = false;
                env["jack.url_scheme"]      = "http"; // FIXME

                // call the app
                var result = null;
                
                try
                {
                    result = app(env);
                }
                catch(e)
                {
                    print(e);

                    result = {
                        status: 500,
                        headers: {"Content-Type":"text/plain"},
                        body: ["Internal Server Error", "</br>", e]
                    }
                }
                
                try
                {
                    var written_bytes = 0,
                        buffer = null,
                        stream = transport.openOutputStream(0,0,0);


                    buffer = "HTTP/1.1 200 OK\n";

                    for( var name in result.headers ) {
                        buffer += name + ": " + result.headers[name] + "\n";
                    }
                    
                    buffer += "\n";

                    written_bytes += stream.write(buffer, buffer.length);

                    result.body.forEach(function(chunk) {

                        var str = chunk.decodeToString('UTF-8');
                        written_bytes += stream.write(str, str.length);

                    });

                    stream.flush();
                    stream.close();
                } 
                catch(e)
                {
                    print("Error on write: " + e);
                }
            } 
            catch (e) 
            {
                print("Error on input: " + e);
                transport.close(0);
                return;
            }

            reader.close();
        }
    };
    
    
    
    function regExec(expr, subject)
    {
        /**
         * NOTE: We are calling exec() on expr twice as it predictably fails on every second call
         */
        var parts = expr.exec(subject);
        if(parts)
            return parts;
        return expr.exec(subject);
    }
}
