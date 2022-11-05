const instance_skel = require('../../instance_skel');
const WebSocket     = require('ws');

class instance extends instance_skel {
	constructor(system, id, config) {
		super(system, id, config);

		this.defineConst('RECONNECT_TIMEOUT', 10); // Number of seconds to try reconnect

		this.reconnecting = null;
		this.closing = false;

		this.actions(); // export actions
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
		this.reconnecting = setTimeout(this.login.bind(this), timeout * 1000);
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
			this.status(this.STATUS_ERROR, 'Disconnected from Smaart');
			if(!this.closing){
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
				value: 'This will connect with Rational Acoustics Smaart server.<br> If using Smaart V9 or newer this module will not work!'
			},
			{
				type: 'textinput',
				id: 'host',
				label: 'Target IP/hostname',
				width: 12,
				regex: this.REGEX_HOSTNAME | this.REGEX_IP
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
			'resetAvg': {
				label: 'Reset Average',
				callback: (action) => {
					this.resetAvg();
				}
			},
			'selectTabByName': {
				label: 'Select Tab By Name',
				options: [
					{
						type: 'textinput',
						label: 'Tab Name',
						id: 'tabName'
					}
				],
				callback: (action) => {
					this.selectTab(action.options.tabName);
				}
			},
			'startAllMeasurements': {
				label: 'Start Measurements By Tab Name',
				options: [
					{
						type: 'textinput',
						label: 'Tab Name',
						id: 'tabName'
					}
				],
				callback: (action) => {
					this.startAllMeasurements(action.options.tabName);
				}
			},
			'startGenerator': {
				label: 'Start signal generator',
				callback: (action) => {
					this.generatorState(true);
				}
			},
			'stopGenerator': {
				label: 'Stop signal generator',
				callback: (action) => {
					this.generatorState(false);
				}
			},
			'setGeneratorLevel': {
				label: 'Set Generator Level',
				options: [
					{
					type: 'number',
					label: 'Level (dB FS)',
					id: 'level',
					min: -200,
					max: 0,
					default: 0,
					required: true
					}
				],
				callback: (action) => {
					this.setGeneratorLevel(action.options.level);
				}
			},
			'startTrackingAll': {
				label: 'Start delay tracking for current tab',
				callback: (action) => {
					this.trackingState(true);
				}
			},
			'stopTrackingAll': {
				label: 'Stop delay tracking for current tab',
				callback: (action) => {
					this.trackingState(false);
				}
			},
			'zoomX': {
				label: 'Zoom X Axis',
				options: [
					{
						type: 'dropdown',
						label: 'Direction',
						id: 'selectedDirection',
						default: '+',
						tooltip: 'Which direction do you want?',
						choices: [
						{ id: '+', label: 'In' },
						{ id: '-', label: 'Out' }
						],
						minChoicesForSearch: 0
					}
				],
				callback: (action) => {
					this.issueCommand('option + command'+action.options.selectedDirection);
				}
			},
			'zoomY': {
				label: 'Zoom Y Axis',
				options: [
					{
						type: 'dropdown',
						label: 'Direction',
						id: 'selectedDirection',
						default: '+',
						tooltip: 'Which direction do you want?',
						choices: [
						{ id: '+', label: 'In' },
						{ id: '-', label: 'Out' }
						],
						minChoicesForSearch: 0
					}
				],
				callback: (action) => {
					this.issueCommand(action.options.selectedDirection);
				}
			},
			'zoomXY': {
				label: 'Zoom X and Y Axis',
				options: [
					{
						type: 'dropdown',
						label: 'Direction',
						id: 'selectedDirection',
						default: '+',
						tooltip: 'Which direction do you want?',
						choices: [
						{ id: '+', label: 'In' },
						{ id: '-', label: 'Out' }
						],
						minChoicesForSearch: 0
					}
				],
				callback: (action) => {
					this.issueCommand('command'+action.options.selectedDirection);
				}
			},
			'setZoomPreset': {
				label: 'Set Zoom Preset',
				options: [
					{
						type: 'dropdown',
						label: 'Preset',
						id: 'zoomPreset',
						default: '5', //Default Zoom
						tooltip: 'Which zoom preset do you want?',
						choices: [
						{ id: '5', label: 'Default zoom' },
						{ id: '1', label: 'Zoom 1' },
						{ id: '2', label: 'Zoom 2' },
						{ id: '3', label: 'Zoom 3' },
						{ id: '4', label: 'Zoom 4' }
						],
						minChoicesForSearch: 0
					}
				],
				callback: (action) => {
					this.issueCommand("option + "+action.options.zoomPreset);
				}
			},
			'arrowKeys': {
				label: 'Send Arrow Keys',
				options: [
					{
						type: 'dropdown',
						label: 'Direction',
						id: 'selectedDirection',
						default: 'up',
						tooltip: 'Which direction do you want?',
						choices: [
						{ id: 'up', label: 'Up' },
						{ id: 'down', label: 'Down' },
						{ id: 'left', label: 'Left' },
						{ id: 'right', label: 'Right' }
						],
						minChoicesForSearch: 0
					}
				],
				callback: (action) => {
					this.issueCommand('cursor '+action.options.selectedDirection);
				}
			},
			'cycleZOrder': {
				label: 'Cycle Z Order',
				options: [
					{
						type: 'dropdown',
						label: 'Direction',
						id: 'selectedDirection',
						default: 'forward',
						tooltip: 'Which direction do you want?',
						choices: [
						{ id: 'forward', label: 'Forward' },
						{ id: 'backward', label: 'Backward' }
						],
						minChoicesForSearch: 0
					}
				],
				callback: (action) => {
					if(action.options.selectedDirection == 'forward'){
						this.issueCommand('Z');
					}
					else if (action.options.selectedDirection == 'backward') {
						this.issueCommand('shift + Z');
					}
				}
			},
			'hideTrace': {
				label: 'Hide Trace',
				callback: (action) => {
					this.issueCommand('H');
				}
			},
			'hideAllTraces': {
				label: 'Hide All Traces',
				callback: (action) => {
					this.issueCommand('shift + command + H');
				}
			},
			'togglePeakHold': {
				label: 'Toggle Peak Hold',
				callback: (action) => {
					this.issueCommand('P');
				}
			},
			'toggleInputMeters': {
				label: 'Toggle Input Meters',
				callback: (action) => {
					this.issueCommand('shift + E');
				}
			},
			'toggleInputMeterOrientation': {
				label: 'Toggle Input Meter Orientation',
				callback: (action) => {
					this.issueCommand('shift + option + E');
				}
			},
			'toggleSPLHistory': {
				label: 'Toggle SPL History',
				callback: (action) => {
					this.issueCommand('option + H');
				}
			},
			'toggleMeters': {
				label: 'Toggle SPL Meters',
				callback: (action) => {
					this.issueCommand('E');
				}
			},
			'selectViewPreset': {
				label: 'Select View Preset',
				options: [
					{
						type: 'dropdown',
						label: 'Preset',
						id: 'viewPreset',
						default: 'S', //Default Zoom
						tooltip: 'Which zoom preset do you want?',
						choices: [
						{ id: 'S', label: 'Spectrum' },
						{ id: 'T', label: 'Transfer' },
						{ id: '1', label: 'User View 1' },
						{ id: '2', label: 'User View 2' },
						{ id: '3', label: 'User View 3' },
						{ id: '4', label: 'User View 4' },
						{ id: '5', label: 'User View 5' },
						{ id: '6', label: 'User View 6' },
						{ id: '7', label: 'User View 7' },
						{ id: '8', label: 'User View 8' },
						{ id: '9', label: 'User View 9' },
						{ id: '0', label: 'Multi-Spectrum' }
						],
						minChoicesForSearch: 0
					}
				],
				callback: (action) => {
					this.issueCommand(action.options.viewPreset);
				}
			},
			'moveFrontTrace': {
				label: 'Trace Y Offset',
				options: [
					{
						type: 'dropdown',
						label: 'Direction',
						id: 'selectedDirection',
						default: 'up',
						tooltip: 'Which direction do you want?',
						choices: [
						{ id: 'up', label: 'Up' },
						{ id: 'down', label: 'Down' }
						],
						minChoicesForSearch: 0
					}
				],
				callback: (action) => {
					this.issueCommand('command + cursor '+action.options.selectedDirection);
				}
			},
			'clearTraceOffset': {
				label: 'Clear Top Trace Y Offset',
				callback: (action) => {
					this.issueCommand('Y');
				}
			},
			'clearAllTraceOffset': {
				label: 'Clear All Y Offsets',
				callback: (action) => {
					this.issueCommand('command + Y');
				}
			},
			'toggleBar': {
				label: 'Toggle Bar',
				options: [
					{
						type: 'dropdown',
						label: 'Bar',
						id: 'selectedBar',
						default: 'O',
						tooltip: 'Which direction do you want?',
						choices: [
						{ id: 'O', label: 'Control' },
						{ id: 'U', label: 'Command' },
						{ id: 'B', label: 'Data' }
						],
						minChoicesForSearch: 0
					}
				],
				callback: (action) => {
					this.issueCommand(action.options.selectedBar);
				}
			},
			'lockCursorToPeak': {
				label: 'Lock Cursor To Peak',
				callback: (action) => {
					this.issueCommand('command + P');
				}
			},
			'clearLockedCursor': {
				label: 'Clear Locked Cursor',
				callback: (action) => {
					this.issueCommand('command + X');
				}
			},
			'moveLockedCursor': {
				label: 'Move Locked Cursor',
				options: [
					{
						type: 'dropdown',
						label: 'Direction',
						id: 'selectedDirection',
						default: 'left',
						tooltip: 'Which direction do you want?',
						choices: [
						{ id: 'left', label: 'Left' },
						{ id: 'right', label: 'Right' }
						],
						minChoicesForSearch: 0
					}
				],
				callback: (action) => {
					this.issueCommand('command + cursor '+action.options.selectedDirection);
				}
			},
			'cyclePlot':{
				label: 'Cycle Preferred Plot',
				callback: (action) => {
					this.issueCommand("M");
				}
			}
		});
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
	 * Sends command to turn the generator on or off
	 * @access public
	 * @since 1.0.0
	 */
	generatorState(state) {
		let payload = {
			"sequenceNumber":13,
			"action":"set",
			"target":"signalGenerator",
			"properties": [
				{ "active":state }
			]
		};

		this.sendData(payload);
	}

	/**
	 * Sends command to set the generator level
	 * @access public
	 * @since 1.0.0
	 */
	setGeneratorLevel(level) {
		let payload = {
		    "sequenceNumber":14,
		    "action":"set",
		    "target":"signalGenerator",
		    "properties": [
		        { "gain":level }
		    ]
		};

		this.sendData(payload);
	}

	/**
	 * Sends command to turn tracking for an entire tab on or off
	 * @access public
	 * @since 1.0.0
	 */
	trackingState(state) {
		let payload = {
			"sequenceNumber":15,
			"action":"set",
			"target": {
				"measurementName": "allTransferFunctionMeasurements"
			},
			"properties": [
				{ "trackingDelay": state }
			]
		};
		this.sendData(payload);
	}

	/**
	 * Sends command to issueCommand handler
	 * @access public
	 * @since 1.0.0
	 */
	issueCommand(command) {
		let payload = {
			"sequenceNumber":16,
			"action":"issueCommand",
			"properties": [
				{ "keypress": command }
			]
		};
		console.log(payload);
		this.sendData(payload);
	}

	/**
	 * Logout of smaart
	 * @access public
	 * @since 1.0.0
	 */
	logout() {
		this.closing = true;
		if(this.reconnecting) {
			clearTimeout(this.reconnecting);
			this.reconnecting = null;
		}

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
