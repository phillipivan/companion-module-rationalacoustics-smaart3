import { InstanceStatus } from '@companion-module/base'
export const errors = [
	{
		id: 'parse error',
		description: 'An error occurred while parsing the JSON request',
		status: InstanceStatus.UnknownWarning,
		statusDescription: 'Parsing Error',
		logLevel: 'warn',
	},
	{
		id: 'timeout',
		description:
			'The timeout elapsed while an asynchronous operation was being carried out (making a window or tab active, etc)',
		status: InstanceStatus.UnknownWarning,
		statusDescription: 'Timeout',
		logLevel: 'warn',
	},
	{
		id: 'unknown target',
		description:
			'The target of the request was not recognized - name misspelled, measurement was specified that was not in the active tab/window. etc.',
		status: InstanceStatus.UnknownWarning,
		statusDescription: 'Unknown Target',
		logLevel: 'warn',
	},
	{
		id: 'unknown action',
		description: 'The action was not recognized by the target',
		status: InstanceStatus.UnknownWarning,
		statusDescription: 'Unknown Action',
		logLevel: 'warn',
	},
	{
		id: 'unkown property',
		description: 'The property does not apply to the target',
		status: InstanceStatus.UnknownWarning,
		statusDescription: 'Unknown Property',
		logLevel: 'warn',
	},
	{
		id: 'unknown value',
		description: 'The value does not apply to the property',
		status: InstanceStatus.UnknownWarning,
		statusDescription: 'Unknown Value',
		logLevel: 'warn',
	},
	{
		id: 'read only',
		description: 'An attempt was made to ‘set’ a property that is read-only',
		status: InstanceStatus.UnknownWarning,
		statusDescription: 'Attempt to set read only property',
		logLevel: 'warn',
	},
	{
		id: 'not implemented',
		description: 'A hole in the implementation, or an unreasonable request has been made',
		status: InstanceStatus.UnknownWarning,
		logLevel: 'warn',
	},
	{
		id: 'signal generator required',
		description:
			'An attempt was made to start a measurement that requires the signal generator to be active - this will not be returned when attempting to start all measurements of a tab',
		status: InstanceStatus.UnknownWarning,
		statusDescription: 'Sig Gen Required',
		logLevel: 'warn',
	},
	{
		id: 'measurement not active',
		description:
			'An attempt to find the delay of a measurement was made while the measurement was not active and the automaticallyStart property was not set',
		status: InstanceStatus.UnknownWarning,
		statusDescription: 'Measurement not active',
		logLevel: 'warn',
	},
	{
		id: 'authentication required',
		description: 'The API requires a password',
		status: InstanceStatus.AuthenticationFailure,
		statusDescription: 'Authentication Required',
		logLevel: 'warn',
	},
	{
		id: 'incorrect password',
		description: 'The submitted password was incorrect',
		status: InstanceStatus.AuthenticationFailure,
		statusDescription: 'Incorrect Password',
		logLevel: 'error',
	},
	{
		id: 'incorect password',
		description: 'The submitted password was incorrect',
		status: InstanceStatus.AuthenticationFailure,
		statusDescription: 'Incorrect Password',
		logLevel: 'error',
	},
	{
		id: 'internal error',
		description: 'Internal error: Theoretical impossibility',
		status: InstanceStatus.UnknownError,
		statusDescription: 'Internal Error',
		logLevel: 'error',
	},
]
