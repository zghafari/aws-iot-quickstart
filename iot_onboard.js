var fs = require("fs");
const https = require('https');
const util = require('util');
var AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-1' });
var iot = new AWS.Iot();

var createThing = async function () {
    var iotThing = "Terminator";
    var iotModel = "T101";
    var iotSerialNumber = "S800T101";
    var iotTenantId = "US-CA-B1";

    var params = {
        thingName: iotThing,
        attributePayload: {
            attributes: {
                Model: iotModel,
                SerialNumber: iotSerialNumber,
                TenantId: iotTenantId
            },
            merge: false
        },
    };

    return await iot.createThing(params).promise()
        .then(function (data) {
            return data;
        }).catch(function (err) {
            console.log(err);
        });
};

var createPolicy = async function () {
    var jsonPolicy = JSON.stringify(JSON.parse(fs.readFileSync("./iot_onboard/iot_policy.json")));

    var params = {
        policyDocument: jsonPolicy,
        policyName: 'allow_all_iot'
    };

    return await iot.createPolicy(params).promise()
        .then(function (data) {
            return data;
        }).catch(function (err) {
            console.log(err);
        });
};

var createKeysAndCertificate = async function () {
    var params = {
        setAsActive: true
    };

    return await iot.createKeysAndCertificate(params).promise()
        .then(function (data) {
            return data;
        }).catch(function (err) {
            console.log(err);
        });
};

var saveKeyInformation = function (data) {
    const file = fs.createWriteStream("./iot_onboard/root-ca.pem");
    const request = https.get("https://www.amazontrust.com/repository/AmazonRootCA1.pem", function (response) {
        response.pipe(file);
    });
    console.log("Successfully written root-ca.");

    fs.writeFile('./iot_onboard/certificate.pem', data.certificatePem, function (err, data) {
        if (err) console.log(err);
        console.log("Successfully written certificate.");
    });

    fs.writeFile('./iot_onboard/public.key', data.keyPair.PublicKey, function (err, data) {
        if (err) console.log(err);
        console.log("Successfully written PublicKey.");
    });

    fs.writeFile('./iot_onboard/private.key', data.keyPair.PrivateKey, function (err, data) {
        if (err) console.log(err);
        console.log("Successfully written PrivateKey.");
    });
};

var attachPolicy = async function (policyName, certificateArn) {
    var params = {
        policyName: policyName,
        target: certificateArn
    };

    return await iot.attachPolicy(params).promise()
        .then(function (data) {
            return data;
        }).catch(function (err) {
            console.log(err);
        });
};

var attachThingPrincipal = async function (iotThing, certificateArn) {
    var params = {
        principal: certificateArn,
        thingName: iotThing
    };

    return await iot.attachThingPrincipal(params).promise()
        .then(function (data) {
            return data;
        }).catch(function (err) {
            console.log(err);
        });
};

var saveEndpoint = async function () {
    var params = {
        endpointType: 'iot:Data-ATS'
    };

    return await iot.describeEndpoint(params).promise()
        .then(function (data) {
            fs.writeFile('./iot_onboard/endpoint.txt', data.endpointAddress, function (err, data) {
                if (err) console.log(err);
                console.log("Successfully written endpoint.");
            });
            return data;
        }).catch(function (err) {
            console.log(err);
        });
}

async function main() {
    const exec = util.promisify(require('child_process').exec);

    async function aws_sdk() {
        const { stdout, stderr } = await exec('npm install aws-sdk');
        console.log('stdout:', stdout);
        console.log('stderr:', stderr);
    }

    async function aws_iot() {
        const { stdout, stderr } = await exec('npm install aws-iot-device-sdk');
        console.log('stdout:', stdout);
        console.log('stderr:', stderr);
    }

    await aws_sdk()
    await aws_iot()
}

async function aws_iot() {
    await saveEndpoint();

    const thingData = await createThing()
    console.log("Thing Created");

    var policyData = await createPolicy()
    console.log("Policy Created");

    var keyData = await createKeysAndCertificate()
    console.log("Keys Created");

    saveKeyInformation(keyData);

    await attachPolicy(policyData.policyName, keyData.certificateArn)
    console.log("Policy Attached to Certificate");

    await attachThingPrincipal(thingData.thingName, keyData.certificateArn)
    console.log("Certificate Attached to Thing");
}

main().then(aws_iot).catch((err) => {
    console.log(err)
});
