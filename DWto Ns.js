/**
 * Module Description
 * Modified Script
 * Version    Date            Author           
 * 1.00       27 March 2017   Shivali Ahuja   
 *
 */



function vendorSyncPost(data){
	nlapiLogExecution('DEBUG','MSG_LOG','======= VendorSync:start =======');
	var objRes = "", internalid = null , externalid = null , operation = "" ;
	try{
		var json = JSON.parse(data);
		nlapiLogExecution('DEBUG','json',json);
		var fields = null, rsVendor = null, capturedField = "", capturedValue = "";
		var vendorFilterExpression = new Array();
	    var vendorcolumns = new Array();
	    vendorcolumns[0] = new nlobjSearchColumn('internalid');

// Modified code for external id condition
		if(json.external_id && json.external_id !=""){
			nlapiLogExecution('DEBUG','MSG_LOG','======= VendorSync: searching for external_id =======');
			vendorFilterExpression[0] = [ 'externalid', 'anyof', json.external_id];
		}
			
		rsVendor = nlapiSearchRecord( 'vendor', null, vendorFilterExpression,vendorcolumns);

	    if(json.external_id == null || json.external_id == undefined || json.external_id =="" ){
	    	json.external_id = json.subsidiary+json.agent_id;
		}

	   	var record = null, country = ""; 
	   	externalid = json.external_id;
	   	if(rsVendor && rsVendor.length > 0 ){
	   		var internalid = rsCustomer[0].getValue('internalid');
	   		record = nlapiLoadRecord('vendor',internalid);
	   		operation="update";
			nlapiLogExecution('DEBUG','MSG_LOG','======= VendorSync: operation -> update =======');
	   	}else{
			record = nlapiCreateRecord('vendor');
			//record.setFieldValue('externalid', json.external_id); //external_id
			operation = "create";
			nlapiLogExecution('DEBUG','MSG_LOG','======= VendorSync: operation -> create =======');
	   	}
	   	if(record != null){
	   		fields = getfieldsMapping().fields;
			var isApplied = function(appliedto,country){ 
				if(appliedto.indexOf(country) != -1 )
					return true; 
				else
				 return false;
			};
			var getSubsidiary = function(code){
			 	arrSubsidiary = [];
				arrSubsidiary["SG"] = 3;
				arrSubsidiary["ID"] = 5;
				arrSubsidiary["TW"] = 6;
				arrSubsidiary["MY"] = 4;
				arrSubsidiary["HK"] = 9;
				arrSubsidiary["PH"] = 9;
				return arrSubsidiary[code];
			};

			var findListId = function(text){
				arrList = [];
				arrList["agent_subscription_type"] = 'customlist140'; //customlist_agentsubstype
				arrList["account_status"] = 'customlist19'; //correct
				arrList["agent_account_rules"] = 'customlist193'; //correct
				arrList["customer_type"] = 'customlist188'; //correct
				arrList["th_districts"] = 'customlist86'; //correct
				return arrList[text];
			};


			var getInternalId = function(recName,text){
				var col = new Array();
				col[0] = new nlobjSearchColumn('name');
				col[1] = new nlobjSearchColumn('internalId');
				var results = nlapiSearchRecord(recName, null, null, col);
				for ( var i = 0; results != null && i < results.length; i++ ){
					var res = results[i];
					var listValue = (res.getValue('name'));
					var listID = (res.getValue('internalId'));
					nlapiLogExecution('DEBUG','MSG_LOG','recName:'+ recName + 'listValue'+listValue+ 'text:'+text + 'listID:'+listID);
					if(listValue.toLowerCase().trim() == text.toLowerCase().trim()){
						nlapiLogExecution('DEBUG','MSG_LOG','listID:'+listID);
						return listID;
					}
				} 
				return null;
			};

			var parseDate = function(date){
				var arrDate = date.split("/"); 
				var yr = arrDate[2].substring(0,4);
				var mo = arrDate[1];
				var day = arrDate[0];
				if(yr.length == 4 && mo.length == 2 && day.length == 2){
					var dt = yr +"/"+ mo +"/"+day;
					return new Date(dt);
				}else{
					return null;
				}
			};
			
	   		var setFieldValue = function(xtype,record,id,val,field){
	   			switch(xtype){
					case "date":
						record.setFieldValue(id, nlapiDateToString(parseDate(val), 'date'));	
					break;
					case "boolean":
						if(val)
							record.setFieldValue(id, 'T');	
						else
							record.setFieldValue(id, 'F');	
					break;
					case "list":
						var listId = findListId(field);
						var intId = getInternalId(listId,val);
						if(intId){
							record.setFieldValue(id,intId);
						}else{
							var message = field +": cannot find the equivalent ID in the list  >>> - not "+operation+"d",
							objRes = {
						   		internalid:internalid,
						   		externalid:externalid,
						   		operation: operation,
						   		message: message,
						   		status: "failed"
						   	};
						   	logsIt(internalid,externalid,operation,message, "failed");
							return JSON.stringify(objRes);
						}
					break;
					case "address":
						var addressFields = getfieldsMapping().fields[getfieldsMapping().fields.length-1].child;	
						if(operation=='update'){
							var lineNum = nlapiGetLineItemCount('addressbook');
							if(lineNum > 0 )
								record.selectLineItem('addressbook', 1); 
							else
								record.selectNewLineItem('addressbook'); 	
						}else{
							record.selectNewLineItem('addressbook'); 
						}

						updateFields(record,addressFields,val,'addressbook');
						//Adding label in address so that API might not create multiple address on update API request
						record.setCurrentLineItemValue('addressbook', 'label', 'Billing Address');
						record.commitLineItem('addressbook');

					break;
					default:
						record.setFieldValue(id,val);
					break;
				} //switch end
	   		};


	   		var updateFields = function(record,childFields,jsonFields,sublist){
				var fields = childFields;
				var json =   jsonFields;
				var sublist = sublist;
				for(var f=0;  fields && f < fields.length; f++ ){
					var internalid = fields[f].internalid, field = fields[f].field, xtype = fields[f].type, mandatory = fields[f].mandatory, appliedto = fields[f].appliedto;
						for(var jsn in json){
						var jsnField = jsn;
						var jsnVal = json[jsn];	
						capturedField = jsnField;
						capturedValue = jsnVal;
						if(isApplied(appliedto,country) && jsnField === field ){
							if(mandatory){
								if(jsnVal && jsnVal != ""){
									//setting the field values
									if(sublist){
										record.setCurrentLineItemValue(sublist,internalid,jsnVal); 
									}else{
										setFieldValue(xtype,record,internalid,jsnVal,jsnField);
									}
								}else{
									var message = field +": is a mandatory field  - not "+operation+"d";
									objRes = {
								   		internalid:internalid,
								   		externalid:externalid,
								   		operation: operation,
								   		message: message,
								   		status: "failed"
								   	};
								   	logsIt(internalid,externalid,operation,message, "failed");
								   	return JSON.stringify(objRes);
								}
							}else{
								if(jsnVal && jsnVal != ""){
									//setting the field values
									if(sublist){
										record.setCurrentLineItemValue(sublist,internalid,jsnVal); 
									}else{
										setFieldValue(xtype,record,internalid,jsnVal,jsnField);
									}
								}
							}
						}
					}
				}
			};

			country = json.subsidiary;
			json.subsidiary = getSubsidiary(country);
			nlapiLogExecution('DEBUG','MSG_LOG','json.company_status:'+json.company_status);
			
			if(!json.company_status){
				nlapiLogExecution('DEBUG','MSG_LOG','entered in empty status company');
				json.company_status = 21;
				nlapiLogExecution('DEBUG','MSG_LOG','json.company_status:'+json.company_status);
			}
			//json.company_status = 21;
			if(json.address.country && json.address.country !="" ){
				json.address['defaultbilling'] = "T";
				json.address['override'] = "T";	
				json.address['addressee'] = json.firstname +' '+json.lastname;	
				
			}
    		nlapiLogExecution('DEBUG','MSG_LOG','======= AgentSync: start: setting values =======');
	   		//loop start
	   		updateFields(record,fields,json);
    		nlapiLogExecution('DEBUG','MSG_LOG','======= AgentSync: end: setting values =======');
    		
    		// Block to give permision to customers to login into Netsuite in Custom access role 
    		var individualtype=record.getFieldValue('isperson');
    		nlapiLogExecution('DEBUG','MSG_LOG','====== AgentSync:SSO: Checking type of Customer : '+ individualtype +'======');
    		
    		if(individualtype=='T'){
    			nlapiLogExecution('DEBUG','MSG_LOG','======= AgentSync: SSO: Entered in Block=======');
        		//SSO Login 
        		record.setFieldValue('password', 'password1234');
        		record.setFieldValue('password2', 'password1234');
        		record.setFieldValue('giveaccess', 'T');
        		
    		}
	        record.setFieldValue('leadsource',-3);
	        
	        // Updating payment terms for all B2C customers to immediate
	        
	        record.setFieldValue('terms',8);
	        internalid = nlapiSubmitRecord(record, true);
			nlapiLogExecution('DEBUG','MSG_LOG','======= AgentSync: record submitted : '+ internalid + ' =======');
	   	}
	   	 var message = "successfuly "+operation+"d";
	   	 objRes = {
	   		internalid:internalid,
	   		externalid:externalid,
	   		operation: operation,
	   		message: message,
	   		status:"success"
	   	};
	   	logsIt(internalid,externalid,operation,message, "success");

	   	return JSON.stringify(objRes);
	}catch(e){
		var stErrMsg = '';
		if (e.getDetails != undefined)
		{
			stErrMsg = e.getCode() + '<br>' + e.getDetails() + '<br>' + e.getStackTrace();
		}
		else
		{
			stErrMsg = e.toString();
		}
		nlapiLogExecution('DEBUG','MSG_LOG','catch error:'+ stErrMsg);
		objRes = {
				internalid:internalid,
				externalid:externalid,
				message:"not "+operation+"d    >>> property:"+capturedField +" = value:"+capturedValue,
				status: "failed",
				systemError: stErrMsg
		};
		logsIt(internalid,externalid,operation,stErrMsg, "failed");
		return JSON.stringify(objRes);
	}
	nlapiLogExecution('DEBUG','MSG_LOG','======= AgentSync:end =======');
}

function getfieldsMapping(){
    return {"fields":[
		{"internalid":"isperson", "field":"is_individual", "type":"boolean",  "mandatory":false, "appliedto":["SG","TH","ID","MY"]},
		{"internalid":"firstname", "field":"firstname", "type":"string", "mandatory":true, "appliedto":["SG","TH","ID","MY"]},
		{"internalid":"lastname", "field":"lastname", "type":"string", "mandatory":true, "appliedto":["SG","TH","ID","MY"]},
		{"internalid":"title", "field":"job_title", "type":"string", "mandatory":false, "appliedto":["SG","TH","ID","MY"]},
		{"internalid":"entitystatus", "field":"company_status", "type":"integer",  "mandatory":true, "appliedto":["SG","TH","ID","MY"]},
		{"internalid":"url", "field":"company_site", "type":"string", "mandatory":false, "appliedto":["SG","TH","ID","MY"]},
		{"internalid":"comments", "field":"comments", "type":"string", "mandatory":false, "appliedto":["SG","TH","ID","MY"]},
		{"internalid":"email", "field":"email", "type":"email",  "mandatory":true, "appliedto":["SG","TH","ID","MY"]},
		{"internalid":"altemail", "field":"alt_email", "type":"email", "mandatory":false, "appliedto":["SG","TH","ID","MY"]},
		{"internalid":"phone", "field":"phone", "type":"phone", "mandatory":true, "appliedto":["SG","TH","ID","MY"]},
		{"internalid":"altphone", "field":"alternative_phone", "type":"phone", "mandatory":false, "appliedto":["SG","TH","ID","MY"]},
		{"internalid":"mobilephone", "field":"mobile_phone", "type":"phone", "mandatory":false, "appliedto":["SG","TH","ID","MY"]},
		{"internalid":"homephone", "field":"home_phone", "type":"phone", "mandatory":false, "appliedto":["SG","TH","ID","MY"]},
		{"internalid":"defaultaddress", "field":"default_address", "type":"string", "mandatory":false, "appliedto":["SG","TH","MY","ID"]},
		{"internalid":"custentity3", "field":"agent_id", "type":"string", "mandatory":true, "appliedto":["SG","TH","ID","MY"]},
		{"internalid":"custentity5", "field":"cea_license_no", "type":"string", "mandatory":false, "appliedto":["SG"]},
		{"internalid":"custentity_pg_agency_name", "field":"agency_name", "type":"string", "mandatory":true, "appliedto":["TH","ID","SG","MY"]},
		{"internalid":"custentity4", "field":"agency_id", "type":"string", "mandatory":false, "appliedto":["SG","TH","ID","MY"]},
		{"internalid":"custentity_agent_subscription_type", "field":"agent_subscription_type", "type":"list", "mandatory":true, "appliedto":["SG","TH","ID","MY"]},
		{"internalid":"custentity7", "field":"account_status", "type":"list", "mandatory":true, "appliedto":["SG","TH","ID","MY"]},
		{"internalid":"custentity_account_create_date", "field":"account_created_date", "type":"date", "mandatory":true, "appliedto":["SG","TH","ID","MY"]},
		{"internalid":"custentity_agent_account_rules", "field":"agent_account_rules", "type":"list", "mandatory":false, "appliedto":["TH","ID","MY","SG"]},
		{"internalid":"subsidiary", "field":"subsidiary", "type":"integer", "mandatory":true, "appliedto":["SG","TH","ID","MY"]},
		{"internalid":"custentity8", "field":"customer_type", "type":"list",  "mandatory":true, "appliedto":["SG","TH","ID","MY"]},
		{"internalid":"custentity_th_districts", "field":"th_districts", "type":"list", "mandatory":false, "appliedto":["TH"]},
		{"internalid":"custentity_apap_status", "field":"apap_status", "type":"boolean", "mandatory":false, "appliedto":["TH","ID"]},
		{"internalid":"custentity_listing_checkdate", "field":"listing_checkdate", "type":"date", "mandatory":false, "appliedto":["TH"]},
		{"internalid":"custentity_buy_package", "field":"buy_package", "type":"boolean", "mandatory":false, "appliedto":["TH"]},
		{"internalid":"custentity_create_account", "field":"create_account", "type":"boolean", "mandatory":false, "appliedto":["TH"]},
		{"internalid":"custentity15", "field":"no_of_listing", "type":"integer",  "mandatory":false, "appliedto":["TH","ID","SG","MY"]},
		{"internalid":"custentity_training_date", "field":"training_date", "type":"date",  "mandatory":false, "appliedto":["TH"]},
		{"internalid":"custentity_listings_by_pla", "field":"listings_by_pla", "type":"integer",  "mandatory":false, "appliedto":["TH"]},
		{"internalid":"custentity_listings_of_agents", "field":"listings_of_agents", "type":"integer",  "mandatory":false, "appliedto":["TH"]},
		{"internalid":"custentity_recycle_bin", "field":"recycle_bin", "type":"boolean",  "mandatory":false, "appliedto":["TH"]},
		{"internalid":"custentity_convert_to_paid", "field":"convert_to_paid", "type":"boolean",  "mandatory":false, "appliedto":["TH"]},
		{"internalid":"custpage_lsa_vis", "field":"last_sales_activity", "type":"date",  "mandatory":false, "appliedto":["TH","ID","SG","MY"]},
		{"internalid":"custentitycustentity_subs_startdate", "field":"subscription_start_date", "type":"date", "mandatory":false, "appliedto":["SG","TH","ID","MY"]},
		{"internalid":"custentity6", "field":"subscription_end_date", "type":"date", "mandatory":false, "appliedto":["SG","TH","ID","MY"]},
		{"internalid":"leadsource", "field":"lead_source", "type":"date", "mandatory":false, "appliedto":["ID"]},
		{"internalid":"externalid", "field":"external_id", "type":"integer", "mandatory":true, "appliedto":["SG","TH","ID","MY"]},
		{"internalid":"custentity_loyalty_start_date", "field":"loyalty_start_date", "type":"date", "mandatory":false, "appliedto":["SG","TH","ID","MY"]},
		{"internalid":"address", "field":"address", "type":"address", "mandatory":false, "appliedto":["SG","TH","MY","ID"],
			"child":[
				{"internalid":"defaultbilling", "field":"defaultbilling", "type":"string", "mandatory":false, "appliedto":["SG","TH","MY","ID"]},
				{"internalid":"override", "field":"override", "type":"string", "mandatory":false, "appliedto":["SG","TH","MY","ID"]},
				{"internalid":"addressee", "field":"addressee", "type":"string", "mandatory":false, "appliedto":["SG","TH","MY","ID"]},
				{"internalid":"addr1", "field":"address1", "type":"string", "mandatory":false, "appliedto":["SG","TH","MY","ID"]},
				{"internalid":"addr2", "field":"address2", "type":"string", "mandatory":false, "appliedto":["SG","TH","MY","ID"]},
				{"internalid":"city", "field":"city", "type":"string", "mandatory":false, "appliedto":["SG","TH","MY","ID"]},
				{"internalid":"state", "field":"region", "type":"string", "mandatory":false, "appliedto":["SG","TH","MY","ID"]},
				{"internalid":"country", "field":"country", "type":"string", "mandatory":false, "appliedto":["SG","TH","MY","ID"]}
			]
		}
    ]};
}   

function logsIt(internalid,externalid,operation,message,status){
	nlapiLogExecution('DEBUG', 'LOG_MSG', '======= logsIt:start ======='); 
	var logger = nlapiCreateRecord('customrecord_agent_sync_logger');
	logger.setFieldValue('custrecord_as_internalid', internalid);
	logger.setFieldValue('custrecord_as_externalid', externalid);
	logger.setFieldValue('custrecord_as_operation', operation);
	logger.setFieldValue('custrecord_as_message', message);
	logger.setFieldValue('custrecord_as_status', status);
	var logId = nlapiSubmitRecord(logger, true);
	nlapiLogExecution('DEBUG', 'LOG_MSG', '======= logsIt:end >>>'+ logId +' ======='); 
}











	
