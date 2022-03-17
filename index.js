
const LNSocket = require('lnsocket')
const http = require('http')

async function create_server()
{
	const server = http.createServer(handle_request)
	return server
}

function handle_request(req, res)
{
	console.log(req.method, req.path)
}


module.exports = serve
