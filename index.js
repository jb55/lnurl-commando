
const LNSocket = require('lnsocket')
const querystring = require('querystring')
const url = require('url')
const http = require('http')
const crypto = require('crypto')
const fs = require('fs/promises')
const path = require('path')

async function create_server(opts={})
{
	if (opts.thumbnail) {
		const image = await fs.readFile(opts.thumbnail)
		opts.thumbnailType = path.extname(opts.thumbnail).slice(1).toLowerCase()
		opts.thumbnail = image.toString('base64')
	}
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
	let metadata = []
	if (opts.description) {
		metadata.push(["text/plain", opts.description])
	}
	if (opts.longDescription) {
		metadata.push([`text/long-desc`, opts.longDescription])
	}
	if (opts.identifier) {
		metadata.push(["text/identifier", opts.identifier])
	}
	if (opts.thumbnail) {
		metadata.push([`image/${opts.thumbnailType};base64`, opts.thumbnail])
	}
	const resp = {
		status: "OK",
		tag: "payRequest",
		minSendable: 1,
		maxSendable: 10000000000,
		callback: opts.callback,
		metadata: JSON.stringify(metadata)
	}
	res.statusCode = 200
	res.write(JSON.stringify(resp))
	res.end()
}

async function handle_payreq(amount, opts, req, res)
{
	try {
		const pr = await make_invoice(opts, amount)
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

function handle_request(opts, req, res)
{
	console.log("%s - %s", req.method, req.url)

	if (req.method == "GET") {
		const parsed = url.parse(req.url)
		const qs = querystring.parse(parsed.query)

		if (qs && qs.amount) {
			handle_payreq(qs.amount, opts, req, res)
			return
		}

		handle_static_payreq(opts, req, res)
		return
	}

	res.statusCode = 404
	res.end()
}

module.exports = create_server




// bin stuff (move this?)


async function main()
{
	const opts = require('minimist')(process.argv.slice(2))

	if (!opts.nodeid || !opts.host || !opts.rune || !opts.callback || !opts.description)
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
	console.log("usage: lnurl-commando --nodeid <nodeid>")
	console.log("                      --host <commando-host>")
	console.log("                      --rune <rune>")
	console.log("                      --callback <lnurl-callback>")
	console.log("                      --description <invoice-description>")
	console.log("                      --longDescription <invoice-long-description>")
	console.log("                      --thumbnail <png|jpg path>")
	console.log("                      --identifier <email, vecndor, etc>")
	process.exit(1)
}
