const config = require("./config.json")
const nodemailer = require('nodemailer');

function now() {
	const date = new Date();
	return new Intl.DateTimeFormat('en-DE', { dateStyle: 'full', timeStyle: 'long' }).format(date);
};
function normalize(string) {
	return string.replace(/\s|:|\.|\-|,/gi, "_")
}
// =================================================
// * email configs
// =================================================
const transporter = nodemailer.createTransport({
	service: 'gmail',
	auth: {
			user: config.userEmail,
			pass: config.userPassword
	}
});
async function sendEmail(mailOptions) {
	console.log("* Sending email");
	let info = await transporter.sendMail(mailOptions);
	console.log("* Email sended status: ", info.response)
}
module.exports = {
	now,
	normalize,
	sendEmail
}