const { sendEmail, now } = require('./utils');
const config = require('./config.json');
// =================================================
// * Crawler configuration
// =================================================
const mailOptions = {
	from: config.userEmail,
	to: config.targetEmail,
	subject: `Free date on ${now()}`,
	html: "This is ready to be sent",
	attachments: [
		{
			filename: 'test.PNG',
			path: './test.PNG',
			// cid: 'unique@kreata.ee' //same cid value as in the html img src
		}
	]
};

(async () => {
	await sendEmail(mailOptions)
})()