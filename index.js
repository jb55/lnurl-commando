
const LNSocket = require('lnsocket')
const querystring = require('querystring')
const url = require('url')
const http = require('http')
const crypto = require('crypto')

async function create_server(opts={})
{
	const server = http.createServer(handle_request.bind(null, opts))
	return server
}

async function make_invoice(opts, amount)
{
	let bolt11 = null
	const ln = await LNSocket()

	try {
		ln.genkey()
		await ln.connect_and_init(opts.nodeid, opts.host)
		const res = await ln.rpc({
			rune: opts.rune,
			method: "invoice",
			params: {
				msatoshi: amount || "any",
				description: opts.description,
				label: crypto.randomUUID().toString(),
			}
		});

		if (res.error && res.error.message)
			throw new Error(res.error.message)

		if (res.error)
			throw new Error(res.error)

		if (!(res.result && res.result.bolt11))
			throw new Error(JSON.stringify(res))

		bolt11 = res.result.bolt11
	} catch (err) {
		ln.destroy()
		console.error(err)
		throw err
	}

	ln.destroy()
	return bolt11
}

function handle_static_payreq(opts, req, res)
{
	const resp = {
		status: "OK",
		tag: "payRequest",
		callback: opts.callback,
		metadata: JSON.stringify([
			["text/plain", opts.description || "Hello from jb55.com!"]
		])
	}
	res.statusCode = 200
	res.write(JSON.stringify(resp))
	res.end()
}

async function handle_payreq(opts, req, res)
{
	const parsed = url.parse(req.url)
	const qs = querystring.parse(parsed.query)
	try {
		const pr = await make_invoice(opts, qs.amount)
		const routes = []
		const resp = JSON.stringify({pr, routes})
		res.statusCode = 200
		res.write(resp)
	} catch (e) {
		res.statusCode = 500
		res.write(JSON.stringify({status: "ERROR", "reason": JSON.stringify(e)}))
	}
	res.end()
	return
}

async function handle_request(opts, req, res)
{
	if (req.method == "GET" && req.url == "/") {
		handle_static_payreq(opts, req, res)
		return

	} else if (req.method == "GET" && req.url.startsWith("/pr")) {
		await handle_payreq(opts, req, res)
		return
	}

	res.statusCode = 404
	res.end()
}

module.exports = create_server


async function main()
{
	const args = process.argv.slice(2)
	const opts = {
		nodeid: args[0] || process.env.NODEID,
		host: args[1] || process.env.HOST,
		rune: args[2] || process.env.RUNE,
		callback: args[3] || process.env.LNURL_CALLBACK,
		description: args[4] || process.env.INVOICE_DESCRIPTION,
	}

	if (!opts.nodeid || !opts.host || !opts.rune || !opts.callback)
		return usage()

	const server = await create_server(opts)

	const port = +process.env.PORT || 8083
	console.log("lnurl-commando listening on port " + port)
	server.listen(port)
}

if (!module.parent) {
	main()
}


function usage() {
	console.log("usage: lnurl-commando <nodeid> <commando-host> <rune> <lnurl-callback> <invoice-description>")
	process.exit(1)
}
