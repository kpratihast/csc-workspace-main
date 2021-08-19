const { addControllers } = WebCardinal.preload;

const cscServices = require('csc-services');
const ACTOR = cscServices.constants.Roles.Site;

const TableTemplateController = cscServices.getController('TableTemplateController', ACTOR);
const SingleOrderController = cscServices.getController('SingleOrderController', ACTOR);
const HistoryModalController = cscServices.getController('HistoryModalController', ACTOR);
const HeaderController = cscServices.getController('HeaderController', ACTOR);
const NotificationsController = cscServices.getController('NotificationsController', ACTOR);
const DashboardMenuController = cscServices.getController('DashboardMenuController', ACTOR);
const DashboardController = cscServices.getController('DashboardController', ACTOR);
const OrdersController = cscServices.getController('OrdersController', ACTOR);

addControllers({
	TableTemplateController,
	SingleOrderController,
	HistoryModalController,
	HeaderController,
	NotificationsController,
	DashboardMenuController,
	DashboardController,
	OrdersController
});