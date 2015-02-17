'use strict';
/**
 * Bonita document manager custom page
 * Author: Philippe Ozil
 * Project page: https://github.com/pozil/bonita-doc-manager
 */

(function() {

var appModule = angular.module('docManager', ['ui.bootstrap', 'ngBonita']);

appModule.config(function (bonitaConfigProvider) {
    bonitaConfigProvider.setBonitaUrl('/bonita');
});

// Constant object storing application static configuration (see documentation)
appModule.constant('APP_CONFIG', {
	// Listing page size
	'UI_PAGE_SIZE' : 10,
	// Resource base path (facilitates integration into a Bonita custom page)
	'RESOURCE_PATH' : 'pageResource?page=custompage_docmanager&location='
});

appModule.controller('DocManagerController', 
	['$scope', '$sce', '$modal', 'APP_CONFIG', 'bonitaConfig', 'bonitaAuthentication',
	function ($scope, $sce, $modal, APP_CONFIG, bonitaConfig, bonitaAuthentication) {
	
		// Ensure we have a valid Bonita session
		bonitaAuthentication.checkForActiveSession();
		
        $scope.getDate = function(dateString) {
			return dateString.substring(0, dateString.lastIndexOf('.'));
        }
    }]);

/*
* PAGINATED LIST CONTROLLERS
*/

// Document list controller
appModule.controller('DocListController', 
	['APP_CONFIG', '$scope', '$sce', '$filter', '$modal', 'bonitaAuthentication', 'CaseDocument', 
	function (APP_CONFIG, $scope, $sce, $filter, $modal, bonitaAuthentication, CaseDocument) {
	
	$scope.docTypeFilter = 'all';
	
	var orderByFilterFunction = null;
	var textFilterFunction = null;
	
	this.list = {items : [], pageIndex : 0, pageSize : 0, totalCount : 0};
	this.filterText = '';
	this.sortColumn = null;
	this.isDescendingSort = false;
	this.tableHeaders = [
		{ name: 'id',			label : 'Doc Id',		isSortable : true},
		{ name: 'caseId',		label : 'Case Id',		isSortable : true},
		{ name: 'creationDate',	label : 'Upload Date',	isSortable : true},
		{ name: 'submittedBy',	label : 'Uploaded By',	isSortable : true},
		{ name: 'name',			label : 'Name',			isSortable : true},
		{ name: 'version',		label : 'Version',		isSortable : true},
		{ name: 'type',			label : 'Type',			isSortable : true},
		{ name: 'index',		label : 'Index <span class="glyphicon glyphicon-info-sign" title="Only applies to document lists"></span>',	isSortable : true},
		{ name: 'fileName',		label : 'File Name / URL',	isSortable : true},
		{ name: 'download',		label : '',				isSortable : false},
		{ name: 'delete',		label : '',				isSortable : false}
	];
	for (var i=0; i<this.tableHeaders.length; i++)
		this.tableHeaders[i].label = $sce.trustAsHtml(this.tableHeaders[i].label);
	
	if (APP_CONFIG.HAS_SERVER_SIDE_PAGINATION)
	{
		// Disable sorting for server side pagination
		for (var i=0; i<this.tableHeaders.length; i++)
			this.tableHeaders[i].isSortable = false;
	}
	else // Client side pagination
	{
		// Prepare listing filters
		orderByFilterFunction = $filter('orderBy');
		textFilterFunction = $filter('filter');
	}
	
	var controller = this;
	
	this.updateView = function(forceDataRefresh) {
		// Prevent data reloading for client side pagination when navigating between pages
		if (!APP_CONFIG.HAS_SERVER_SIDE_PAGINATION && !forceDataRefresh)
			return;
		// Reset displayed data
		controller.filterText = '';
		controller.sortColumn = null;
		controller.isDescendingSort = false;
		controller.list.items = [];
		// Query new data
		CaseDocument.search({p : controller.list.pageIndex, c : APP_CONFIG.UI_PAGE_SIZE, d : 'submittedBy'}).$promise.then(function(docList) {
			// Transform list (for sorting/filtering)
			for (var i=0; i<docList.items.length; i++)
			{
				// Assemble uploader user name
				docList.items[i].submittedByUserLabel = docList.items[i].submittedBy.firstname +' '+ docList.items[i].submittedBy.lastname;
				// Assemble file name and URL
				if (docList.items[i].isInternal == 'false')
					docList.items[i].fileName = docList.items[i].url;
			}
			// Save updated list
			controller.list = docList;
			// Update list stats for client side pagination
			if (!APP_CONFIG.HAS_SERVER_SIDE_PAGINATION)
			{
				controller.list.pageSize = APP_CONFIG.UI_PAGE_SIZE;
				controller.list.totalCount = controller.list.items.length;
			}
		});
	};
	
	// Init data when we acquire user session
	$scope.$watch(
		function () { return bonitaAuthentication.isLogged; },
		function (newValue, oldValue) {
			if (newValue === true)
				controller.updateView(true);
		}
	);
	
	$scope.getIndexLabel = function(index) {
		return index == '-1' ? 'n/a' : index;
	};
	
	$scope.getTypeLabel = function(doc) {
		if (doc.index == '-1')
			return doc.isInternal == 'true' ? 'Single file' : 'Single URL';
		else
			return doc.isInternal == 'true' ? 'File list' : 'URL list';
	};
	
	$scope.getDocDownloadLink = function(doc) {
		return doc.isInternal == 'true' ? '/bonita/portal/'+ doc.url : doc.url;
	};
	
	$scope.isDocDownloadable = function(doc) {
		return doc.url != '';
	};
	
	// Modal dialog for delete confirmation
	$scope.openDeleteModal = function(document) {
		var modalInstance = $modal.open({
			templateUrl: APP_CONFIG.RESOURCE_PATH +'directives/modal/docDeleteModal.html',
			controller: ['$scope', '$modalInstance', function ($scope, $modalInstance) {

				$scope.cancel = function () {
					$modalInstance.close();
				};
				$scope.confirm = function () {
					$modalInstance.close();
					// Delete document
					var doc = new CaseDocument({id : document.id});
					doc.$delete();
					// Update list
					controller.updateView(true);
				};
			}]
		});
	};
	
	// Client side common pagination methods
	this.getHeader = function(name)				{	return getHeader(controller, name);	};
	this.orderBy = function(tableHeader)		{	orderBy(controller, tableHeader, orderByFilterFunction);	};
	this.getHeaderClass = function(tableHeader) {	return getHeaderClass(controller, tableHeader);	};
	this.getCellClass = function(colName)		{	return getCellClass(controller, colName);	};
	// Common pagination methods
	this.isFilterDisplayed = function()	{	return isFilterDisplayed(APP_CONFIG);	}
	this.getCountLabel = function()		{	return getCountLabel(controller);	};
	this.hasPreviousPage = function()	{	return hasPreviousPage(controller);	}
	this.hasNextPage = function()		{	return hasNextPage(controller);	}
	this.showPreviousPage = function()	{	showPreviousPage(controller);	}
	this.showNextPage = function()		{	showNextPage(controller);	}
	
	this.getFilteredAndSortedList = function()
	{
		var list = getFilteredAndSortedList(controller, APP_CONFIG, textFilterFunction, $scope.filterText);
		list = $filter('docTypeFilter')(list, $scope.docTypeFilter);
		return list;
	};
}]);

// Archived document list controller
appModule.controller('ArchivedDocListController', 
	['APP_CONFIG', '$scope', '$sce', '$filter', '$modal', 'bonitaAuthentication', 'ArchivedCaseDocument', 
	function (APP_CONFIG, $scope, $sce, $filter, $modal, bonitaAuthentication, ArchivedCaseDocument) {
	
	$scope.docTypeFilter = 'all';
	
	var orderByFilterFunction = null;
	var textFilterFunction = null;
	
	this.list = {items : [], pageIndex : 0, pageSize : 0, totalCount : 0};
	this.filterText = '';
	this.sortColumn = null;
	this.isDescendingSort = false;
	this.tableHeaders = [
		{ name: 'id',			label : 'Doc Id',		isSortable : true},
		{ name: 'caseId',		label : 'Case Id',		isSortable : true},
		{ name: 'creationDate',	label : 'Upload Date',	isSortable : true},
		{ name: 'submittedBy',	label : 'Uploaded By',	isSortable : true},
		{ name: 'archivedDate',	label : 'Archived Date',	isSortable : true},
		{ name: 'name',			label : 'Name',			isSortable : true},
		{ name: 'version',		label : 'Version',		isSortable : true},
		{ name: 'type',			label : 'Type',			isSortable : true},
		{ name: 'index',		label : 'Index <span class="glyphicon glyphicon-info-sign" title="Only applies to document lists"></span>',	isSortable : true},
		{ name: 'fileName',		label : 'File Name / URL',	isSortable : true},
		{ name: 'download',		label : '',				isSortable : false},
		{ name: 'delete',		label : '',				isSortable : false}
	];
	for (var i=0; i<this.tableHeaders.length; i++)
		this.tableHeaders[i].label = $sce.trustAsHtml(this.tableHeaders[i].label);
	
	if (APP_CONFIG.HAS_SERVER_SIDE_PAGINATION)
	{
		// Disable sorting for server side pagination
		for (var i=0; i<this.tableHeaders.length; i++)
			this.tableHeaders[i].isSortable = false;
	}
	else // Client side pagination
	{
		// Prepare listing filters
		orderByFilterFunction = $filter('orderBy');
		textFilterFunction = $filter('filter');
	}
	
	var controller = this;
	
	this.updateView = function(forceDataRefresh) {
		// Prevent data reloading for client side pagination when navigating between pages
		if (!APP_CONFIG.HAS_SERVER_SIDE_PAGINATION && !forceDataRefresh)
			return;
		// Reset displayed data
		controller.filterText = '';
		controller.sortColumn = null;
		controller.isDescendingSort = false;
		controller.list.items = [];
		// Query new data
		ArchivedCaseDocument.search({p : controller.list.pageIndex, c : APP_CONFIG.UI_PAGE_SIZE, d : 'submittedBy'}).$promise.then(function(docList) {
			// Transform list (for sorting/filtering)
			for (var i=0; i<docList.items.length; i++)
			{
				// Assemble uploader user name
				docList.items[i].submittedByUserLabel = docList.items[i].submittedBy.firstname +' '+ docList.items[i].submittedBy.lastname;
				// Assemble file name and URL
				if (docList.items[i].isInternal == 'false')
					docList.items[i].fileName = docList.items[i].url;
			}
			// Save updated list
			controller.list = docList;
			// Update list stats for client side pagination
			if (!APP_CONFIG.HAS_SERVER_SIDE_PAGINATION)
			{
				controller.list.pageSize = APP_CONFIG.UI_PAGE_SIZE;
				controller.list.totalCount = controller.list.items.length;
			}
		});
	};
	
	// Init data when we acquire user session
	$scope.$watch(
		function () { return bonitaAuthentication.isLogged; },
		function (newValue, oldValue) {
			if (newValue === true)
				controller.updateView(true);
		}
	);
	
	$scope.getIndexLabel = function(index) {
		return index == '-1' ? 'n/a' : index;
	};
	
	$scope.getTypeLabel = function(doc) {
		if (doc.index == '-1')
			return doc.isInternal == 'true' ? 'Single file' : 'Single URL';
		else
			return doc.isInternal == 'true' ? 'File list' : 'URL list';
	};
	
	$scope.getDocDownloadLink = function(doc) {
		return doc.isInternal == 'true' ? '/bonita/portal/'+ doc.url : doc.url;
	};
	
	$scope.isDocDownloadable = function(doc) {
		return doc.url != '';
	};
	
	// Modal dialog for delete confirmation
	$scope.openDeleteModal = function(document) {
		var modalInstance = $modal.open({
			templateUrl: APP_CONFIG.RESOURCE_PATH +'directives/modal/docDeleteModal.html',
			controller: ['$scope', '$modalInstance', function ($scope, $modalInstance) {

				$scope.cancel = function () {
					$modalInstance.close();
				};
				$scope.confirm = function () {
					$modalInstance.close();
					// Delete document
					var doc = new ArchivedCaseDocument({id : document.id});
					doc.$delete();
					// Update list
					controller.updateView(true);
				};
			}]
		});
	};
	
	// Client side common pagination methods
	this.getHeader = function(name)				{	return getHeader(controller, name);	};
	this.orderBy = function(tableHeader)		{	orderBy(controller, tableHeader, orderByFilterFunction);	};
	this.getHeaderClass = function(tableHeader) {	return getHeaderClass(controller, tableHeader);	};
	this.getCellClass = function(colName)		{	return getCellClass(controller, colName);	};
	// Common pagination methods
	this.isFilterDisplayed = function()	{	return isFilterDisplayed(APP_CONFIG);	}
	this.getCountLabel = function()		{	return getCountLabel(controller);	};
	this.hasPreviousPage = function()	{	return hasPreviousPage(controller);	}
	this.hasNextPage = function()		{	return hasNextPage(controller);	}
	this.showPreviousPage = function()	{	showPreviousPage(controller);	}
	this.showNextPage = function()		{	showNextPage(controller);	}
	
	this.getFilteredAndSortedList = function()
	{
		var list = getFilteredAndSortedList(controller, APP_CONFIG, textFilterFunction, $scope.filterText);
		list = $filter('docTypeFilter')(list, $scope.docTypeFilter);
		return list;
	};
}]);


/**
* Shared document type filter
*/
appModule.filter('docTypeFilter', function() {
	return function(unfilteredList, docTypeValue) {
		var filteredList = [];
		for (var i=0; i<unfilteredList.length; i++)
		{
			switch (docTypeValue)
			{
			case 'all':
				filteredList.push(unfilteredList[i]);
				break;
			case 'single':
				if (unfilteredList[i].index == -1)
					filteredList.push(unfilteredList[i]);
				break;
			case 'list':
				if (unfilteredList[i].index != -1)
					filteredList.push(unfilteredList[i]);
				break;
			default:
				throw 'Unknown document type filter value: '+ docTypeValue;
				break;
			}
		}
		return filteredList;
	};
});


/*
* CLIENT SIDE COMMON PAGINATION METHODS DEFINITIONS
*/
function getCellClass(controller, colName) {
	return (controller.sortColumn === colName) ? 'sorted' : 'unsorted';
};

function getHeaderClass(controller, tableHeader) {
	if (tableHeader.isSortable)
	{
		if (controller.sortColumn === tableHeader.name)
			return (controller.isDescendingSort) ? 'sort_desc' : 'sort_asc';
		else
			return 'unsorted';
	}
	else
		return 'unsortable';
};

function getHeader(controller, name) {
	var header = null;
	for (var i=0; header === null && i < controller.tableHeaders.length; i++)
	{
		if (controller.tableHeaders[i].name == name)
			header = controller.tableHeaders[i];
	}
	return header;
};

function orderBy(controller, tableHeader, orderByFilter) {
	// Check if column is sortable
	if (!tableHeader.isSortable)
		return;
	// Sort
	controller.isDescendingSort = (controller.sortColumn === tableHeader.name) ? !controller.isDescendingSort : false;
	controller.sortColumn = tableHeader.name;
	controller.list.items = orderByFilter(controller.list.items, controller.sortColumn, controller.isDescendingSort);
}

/*
* COMMON PAGINATION METHODS DEFINITIONS
*/
function isFilterDisplayed(APP_CONFIG) {
	return !APP_CONFIG.HAS_SERVER_SIDE_PAGINATION;
}

function getCount(controller) {
	if (controller.list == null)
		return "-";
	else
		return controller.list.totalCount;
}

function getCountLabel(controller) {
	if (!controller.list.items)
		return '';
	if (controller.list.totalCount === 0)
		return 'No result';
	
	var startIndex = controller.list.pageIndex * controller.list.pageSize;
	var endIndex = startIndex + controller.list.pageSize;
	if (endIndex > controller.list.totalCount)
		endIndex = controller.list.totalCount;
	return 'Showing from '+ (startIndex+1) +' to '+ endIndex +' out of '+ controller.list.totalCount;
}

function hasPreviousPage(controller) {
	return controller.list.pageIndex > 0;
}

function hasNextPage(controller) {
	var startIndex = controller.list.pageIndex * controller.list.pageSize;
	var endIndex = startIndex + controller.list.pageSize;
	if (endIndex > controller.list.totalCount)
		endIndex = controller.list.totalCount;
	return endIndex < controller.list.totalCount;
}

function showPreviousPage(controller) {
	controller.list.pageIndex --;
	controller.updateView(false);
}

function showNextPage(controller) {
	controller.list.pageIndex ++;
	controller.updateView(false);
}

function getItems(controller) {
	return controller.list.items;
}

function getFilteredAndSortedList(controller, APP_CONFIG, textFilterFunction, textFilterValue)
{
	if (APP_CONFIG.HAS_SERVER_SIDE_PAGINATION)
		return controller.list.items;
	else // Client side pagination
	{
		// Apply text filter if needed
		var sortedAndFilteredList = textFilterFunction(controller.list.items, textFilterValue);
		// Update total count for pagination
		controller.list.totalCount = sortedAndFilteredList.length;
		// Force list pagination
		var startIndex = controller.list.pageIndex * APP_CONFIG.UI_PAGE_SIZE;
		return sortedAndFilteredList.slice(startIndex, startIndex + APP_CONFIG.UI_PAGE_SIZE);
	}
}

/*
* DASHBOARD PANE DIRECTIVES
*/

// Document list
appModule.directive("docList", ['APP_CONFIG', function(APP_CONFIG) {
	return {
		restrict: 'E',
		templateUrl: APP_CONFIG.RESOURCE_PATH +'directives/doc-list.html'
	};
}]);

// Archived document list
appModule.directive("archivedDocList", ['APP_CONFIG', function(APP_CONFIG) {
	return {
		restrict: 'E',
		templateUrl: APP_CONFIG.RESOURCE_PATH +'directives/archived-doc-list.html'
	};
}]);

// Pagination controls directive
appModule.directive("paginationContainer", ['APP_CONFIG', function(APP_CONFIG) {
	return {
		restrict: 'E',
		templateUrl: APP_CONFIG.RESOURCE_PATH +'directives/pagination-container.html'
	};
}]);


})();