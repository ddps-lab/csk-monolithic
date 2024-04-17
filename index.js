const fetch = require("node-fetch");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const supplier = require("./app/controller/supplier.controller");
const app = express();
const mustacheExpress = require("mustache-express");
const favicon = require("serve-favicon");

// parse requests of content-type: application/json
app.use(bodyParser.json());
// parse requests of content-type: application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());
app.options("*", cors());
app.engine("html", mustacheExpress());
app.set("view engine", "html");
app.set("views", __dirname + "/views");
app.use(express.static("public"));
app.use(favicon(__dirname + "/public/img/favicon.ico"));

// 메타데이터 토큰을 가져오는 함수
async function fetchToken() {
	const response = await fetch("http://169.254.169.254/latest/api/token", {
		method: "PUT",
		headers: {
			"X-aws-ec2-metadata-token-ttl-seconds": "21600",
		},
	});
	return response.text();
}

// 주어진 메타데이터 경로에서 데이터를 가져오는 함수
async function fetchMetadata(path, token) {
	const response = await fetch(`http://169.254.169.254/latest/meta-data/${path}`, {
		headers: {
			"X-aws-ec2-metadata-token": token,
		},
	});
	return response.text();
}

// 지리적 정보를 가져오는 함수
async function fetchGeoinfo(ip_address) {
	const response = await fetch(`http://ip-api.com/json/${ip_address}`);
	const data = await response.json();

	return {
		country: data.country,
		region: data.regionName,
		lat_long: `${data.lat}, ${data.lon}`,
		timezone: data.timezone,
	};
}

// list all the suppliers
app.get("/", async (req, res) => {
	try {
		const token = await fetchToken(); // 토큰 가져옴
		// 각 메타데이터 항목에 대한 요청을 비동기적으로 처리
		const [public_ip, instance_id, instance_type, avail_zone] = await Promise.all([
			fetchMetadata("public-ipv4", token),
			fetchMetadata("instance-id", token),
			fetchMetadata("instance-type", token),
			fetchMetadata("placement/availability-zone", token),
		]);
		const geo_info = await fetchGeoinfo(public_ip);
		// 모든 메타데이터를 받은 후 응답을 렌더링
		res.render("home", {
			public_ip: public_ip,
			instance_id: instance_id,
			instance_type: instance_type,
			avail_zone: avail_zone,
			geo_country_name: geo_info.country,
			geo_region_name: geo_info.region,
			geo_lat_long: geo_info.lat_long,
			geo_timezone: geo_info.timezone,
		});
	} catch (error) {
		// 에러 처리
		console.error("Error fetching EC2 metadata:", error);
		res.render("home", {});
	}
});

app.get("/suppliers/", supplier.findAll);
// show the add suppler form
app.get("/supplier-add", (req, res) => {
	res.render("supplier-add", {});
});
// receive the add supplier POST
app.post("/supplier-add", supplier.create);
// show the update form
app.get("/supplier-update/:id", supplier.findOne);
// receive the update POST
app.post("/supplier-update", supplier.update);
// receive the POST to delete a supplier
app.post("/supplier-remove/:id", supplier.remove);
// handle 404
app.use(function (req, res, next) {
	res.status(404).render("404", {});
});

// set port, listen for requests
const app_port = process.env.APP_PORT || 8080;
app.listen(app_port, () => {
	console.log(`Server is running on port ${app_port}.`);
});
