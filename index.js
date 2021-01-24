const instance_skel = require('../../instance_skel');
const WebSocket     = require('ws');

class instance extends instance_skel {
	constructor(system, id, config) {
		super(system, id, config);

		this.defineConst('RECONNECT_TIMEOUT', 10); // Number of seconds to try reconnect

		this.reconnecting = null;
		this.closing = false;

		this.actions(); // export actions

		return this;
	}

	/**
	 * Process configuration updates
	 * @param {Object} config New configuration
	 * @access public
	 * @since 1.0.0
	 */
	updateConfig(config) {
		this.config = config;

		this.logout();
		if(this.config.host && this.config.port) {
			this.login();
		}
	}

	/**
	 * Main initialization when it's ok to login
	 * @access public
	 * @since 1.0.0
	 */
	init() {
		this.status(this.STATUS_UNKNOWN);
//		this.initVariables();

		if(this.config.host && this.config.port) {
			this.login();
		}
	}

	/**
	 * Try login again after timeout
	 * @param {Int} timeout Timeout to try reconnection
	 * @access public
	 * @since 1.0.0
	 */
	keep_login_retry(timeout) {
		if(this.reconnecting) {
			return;
		}

		this.log('info', 'Attempting to reconnect in ' + timeout + ' seconds.');
		this.reconnecting = setTimeout(this.login.bind(this, true), timeout * 1000);
	}

	/**
	 * Login to the device
	 * @param {Boolean} retry Set to true to continue retrying logins (only after a good first connection)
	 * @access public
	 * @since 1.0.0
	 */
	login() {
		this.logout();

		this.closing = false;

		if(this.reconnecting) {
			clearTimeout(this.reconnecting);
			this.reconnecting = null;
		}

		// Connect to remote control websocket of ProPresenter
		this.socket = new WebSocket('ws://'+this.config.host+':'+this.config.port+'/api/v3/');

		this.socket.on('open', () => {
			this.status(this.STATUS_OK);
			this.sendData({
				'sequenceNumber':1,
				'action':'get'
			});
		});

		this.socket.on('error', (err) => {
			console.log(err);
			this.status(this.STATUS_ERROR, err.message);
		});

		this.socket.on('close', (code, reason) => {
			if(!this.closing){
				this.status(this.STATUS_ERROR, 'Not connected to Smaart');
				console.log(code);
				console.log(reason);
				this.keep_login_retry(this.RECONNECT_TIMEOUT);
			}
		});

		this.socket.on('message', (message) => {
			try {
				let jsonMsg = JSON.parse(message);

				if(jsonMsg['response']['error'] != undefined) {
					if(jsonMsg['response']['error'] === "incorect password") {
						this.status(this.STATUS_ERROR);
						this.log('error', 'Password is incorrect.');
						this.keep_login_retry(10);
					}
				}
				else{
					this.status(this.STATUS_OK);
					console.log(message);

					if((jsonMsg['sequenceNumber'] === 1) && (jsonMsg['response']['authenticationRequired'])) {
						this.log('info', 'Authenticating');
						this.sendData({
							"action":"set",
							"properties": [
								{
									"password": this.config.password
								}
							]
						});
					}
				}
			}
			catch (e) {
				this.status(this.STATUS_ERROR);
				this.log('error', 'Parsing Error.');
			}
		});
	}

	/**
	 * Configuration fields that can be used
	 * @returns {Array}
	 * @access public
	 * @since 1.0.0
	 */
	config_fields() {
		return [
			{
				type: 'text',
				id: 'info',
				width: 12,
				label: 'Information',
				value: 'This will connect with Rational Acoustics Smaart server.'
			},
			{
				type: 'textinput',
				id: 'host',
				label: 'Target IP',
				width: 12,
				regex: this.REGEX_IP
			},
			{
				type: 'textinput',
				id: 'port',
				label: 'Target Port',
				width: 12,
				regex: this.REGEX_PORT
			},
			{
				type: 'text',
				id: 'info',
				width: 12,
				label: 'Information',
				value: 'If authentication is not used leave password blank.'
			},
			{
				type: 'textinput',
				id: 'password',
				label: 'Password',
				width: 6
			}
		]
	}

	/**
	 * Setup the actions
	 * @param {Object} system
	 * @access public
	 * @since 1.0.0
	 */
	actions(system) {
		this.setActions({
			'resetAvg': { label: 'Reset Average'},
			'selectTabByName': {
				label: 'Select Tab By Name',
				options: [
					{
						type: 'textinput',
						label: 'Tab Name',
						id: 'tabName'
					}
				]
			},
			'startAllMeasurements': {
				label: 'Start Measurements By Tab Name',
				options: [
					{
						type: 'textinput',
						label: 'Tab Name',
						id: 'tabName'
					}
				]
			}
		});
	}

	/**
	 * Executes the action
	 * @param {Object} action Action to execute
	 * @access public
	 * @since 1.0.0
	 */
	action(action) {
		var opt = action.options;

		switch (action.action) {
			case 'resetAvg':
				this.resetAvg();
				break;
			case 'selectTabByName':
				this.selectTab(opt.tabName);
				break;
			case 'selectTabByDrop':
				this.selectTab(opt.tabName);
				break;
			case 'startAllMeasurements':
				this.startAllMeasurements(opt.tabName);
				break;
		}
	}

	sendData(jsonPayload) {
		if(this.socket != undefined){
			this.socket.send(JSON.stringify(jsonPayload));
		}
		else{
			this.log('error', 'Not connected!');
		}
	}

	/**
	 * Sends command to reset averages
	 * @access public
	 * @since 1.0.0
	 */
	resetAvg() {
		let payload = {
			"sequenceNumber":10,
			'action':'set',
			'target':'activeMeasurements',
			'properties': [
				{
					'runningAverage': 0
				}
			]
		};

		this.sendData(payload);
	}

	/**
	 * Sends command to change tabs
	 * @access public
	 * @since 1.0.0
	 */
	selectTab(tabName) {
		let payload = {
			"sequenceNumber":11,
			"action":"set",
			"target":"tabs",
			"properties": [
				{
					"activeTab":tabName
				}
			]
		};

		this.sendData(payload);
	}

	/**
	 * Sends command to start all measurments on a tab
	 * @access public
	 * @since 1.0.0
	 */
	startAllMeasurements(tabName) {
		let payload = {
			"sequenceNumber":12,
			"action":"set",
			"target": {
				"tabName":tabName,
				"measurementName": "allMeasurements"
			},
			"properties": [
				{"active": true }
			]
		};

		this.sendData(payload);
	}

	/**
	 * Logout of smaart
	 * @access public
	 * @since 1.0.0
	 */
	logout() {
		this.closing = true;
		if (this.socket !== undefined) {
			// Disconnect if already connected
			if (this.socket.readyState !== 3 /*CLOSED*/) {
				this.socket.terminate();
			}
			delete this.socket;
		}
	}

	/**
	 * Ends session if connected
	 * @since 1.0.0
	 */
	destroy() {
		this.logout();
	}
}

exports = module.exports = instance;
