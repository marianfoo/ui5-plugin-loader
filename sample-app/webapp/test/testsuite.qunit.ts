export default {
	name: "QUnit test suite for the UI5 Application: com.pluginloader",
	defaults: {
		page: "ui5://test-resources/com/pluginloader/Test.qunit.html?testsuite={suite}&test={name}",
		qunit: {
			version: 2
		},
		sinon: {
			version: 4
		},
		ui5: {
			language: "EN",
			theme: "sap_horizon"
		},
		coverage: {
			only: "com/pluginloader/",
			never: "test-resources/com/pluginloader/"
		},
		loader: {
			paths: {
				"com/pluginloader": "../"
			}
		}
	},
	tests: {
		"unit/unitTests": {
			title: "Unit tests for com.pluginloader"
		},
		"integration/opaTests": {
			title: "Integration tests for com.pluginloader"
		}
	}
};
