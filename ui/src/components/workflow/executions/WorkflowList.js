import React, { Component } from 'react';
import { Link, browserHistory } from 'react-router';
import { Breadcrumb, BreadcrumbItem, Input, Well, Button, Panel, DropdownButton, MenuItem, Popover, OverlayTrigger, ButtonGroup, Grid, Row, Col, Table  } from 'react-bootstrap';
import {BootstrapTable, TableHeaderColumn} from 'react-bootstrap-table';
import { connect } from 'react-redux';
import { searchWorkflows, getWorkflowDefs } from '../../../actions/WorkflowActions';
import WorkflowAction  from './WorkflowAction';
import Typeahead from 'react-bootstrap-typeahead';
import Select from 'react-select';
import moment from 'moment';
const ILLEGAL_SEARCH_CHARACTERS = /#|"|%|&|\\/;
const Workflow = React.createClass({

  getInitialState() {
   this.state = {
              datefrm: new Date(),
              dateto:new Date(),
              csv:'false'
          };
    let h = this.props.location.query.h;
    let range = this.props.location.query.range;
    if(range != null && range != '') {
      range = range.split(',');
    }else {
      range = [];
    }

    let workflowTypes = this.props.location.query.workflowTypes;
    if(workflowTypes != null && workflowTypes != '') {
      workflowTypes = workflowTypes.split(',');
    }else {
      workflowTypes = [];
    }
    let status = this.props.location.query.status;
    if(status != null && status != '') {
      status = status.split(',');
    }else {
      status = [];
    }
    let search = this.props.location.query.q;
    if(search == null || search == 'undefined' || search == '') {
      search = '';
    }
    let st = this.props.location.query.start;
    let start = 0;
    if(!isNaN(st)) {
      start = parseInt(st);
    }

    return {
      range: range,
      search: search,
      workflowTypes: workflowTypes,
      status: status,
      h: h,
      workflows: [],
      update: true,
      fullstr: true,
      start: start
    }
  },

  componentWillMount(){
    this.props.dispatch(getWorkflowDefs());
    this.doDispatch();
  },
  componentWillReceiveProps(nextProps) {

    let workflowDefs = nextProps.workflows;
    workflowDefs = workflowDefs ? workflowDefs : [];
    workflowDefs = workflowDefs.map(workflowDef => workflowDef.name);

    let search = nextProps.location.query.q;
    if(search == null || search == 'undefined' || search == '') {
      search = '';
    }

    let h = nextProps.location.query.h;
    if(isNaN(h)) {
      h = '';
    }
    let start = nextProps.location.query.start;
    if(isNaN(start)) {
      start = 0;
    }
    let status = nextProps.location.query.status;
    if(status != null && status != '') {
      status = status.split(',');
    }else {
      status = [];
    }

    let range = nextProps.location.query.range;
    if(range != null && range != '') {
      range = range.split(',');
    }else {
      range = [];
    }

    let update = true;
    update = this.state.search != search;
    update = update || (this.state.h != h);
    update = update || (this.state.start != start);
    update = update || (this.state.status.join(',') != status.join(','));
    update = update || (this.state.range.join(',') != range.join(','));

    this.setState({
      range: range,
      search : search,
      h : h,
      update : update,
      status : status,
      workflows : workflowDefs,
      start : start
    });

    this.refreshResults();
  },

   async  exportcsv() {
      this.state.update = true;
      this.state.csv = 'true';
      let search = '';
        if(this.state.search != '') {
          search = this.state.search;
        }
        let query = [];

        if(this.state.workflowTypes.length > 0) {
          query.push('workflowType IN (' + this.state.workflowTypes.join(',') + ') ');
        }
        if(this.state.status.length > 0) {
          query.push('status IN (' + this.state.status.join(',') + ') ');
        }
       this.props.dispatch(searchWorkflows(query.join(' AND '), search, this.state.h, this.state.fullstr, this.state.start, this.state.range,this.state.datefrm,this.state.dateto,this.state.csv))
       .then(() => {
        this.table.handleExportCSV()
        this.state.csv = ''
       })
    },

    searchBtnClick() {
        this.state.update = true;
        this.refreshResults();
      },
    refreshResults() {
    if(this.state.update) {
      this.state.update = false;
      this.urlUpdate();
      this.doDispatch();
    }
  },
  urlUpdate() {

    let q = this.state.search;
    let h = this.state.h;
    let workflowTypes = this.state.workflowTypes;
    let status = this.state.status;
    let start = this.state.start;
    let range = this.state.range;
    let frmdate = this.state.datefrm;
    let todate = this.state.dateto;
    let csv = this.state.csv;
    this.props.history.pushState(null, "/workflow?q=" + q + "&h=" + h + "&workflowTypes=" + workflowTypes + "&status=" + status + "&start=" + start + "&range=" + range+"&frmdate="+frmdate+"&todate="+todate+"&csv="+csv);
  },
  doDispatch() {

    let search = '';
    if(this.state.search != '') {
      search = this.state.search;
    }
    let query = [];

    if(this.state.workflowTypes.length > 0) {
      query.push('workflowType IN (' + this.state.workflowTypes.join(',') + ') ');
    }
    if(this.state.status.length > 0) {
      query.push('status IN (' + this.state.status.join(',') + ') ');
    }
   this.props.dispatch(searchWorkflows(query.join(' AND '), search, this.state.h, this.state.fullstr, this.state.start, this.state.range,this.state.datefrm,this.state.dateto,this.state.csv))

  },
  workflowTypeChange(workflowTypes) {
    this.state.update = true;
    this.state.workflowTypes = workflowTypes;
    this.refreshResults();
  },
  statusChange(status) {
    this.state.update = true;
    this.state.status = status;
    this.refreshResults();
  },
  rangeChange(range) {
    if (range != null && range.length > 0) {
      let value = range[range.length - 1];
      this.state.range = [value];
    } else {
      this.state.range = [];
    }
    this.state.update = true;
    this.refreshResults();
  },
  nextPage() {
    this.state.start = 100 + parseInt(this.state.start);
    this.state.update = true;
    this.refreshResults();
  },
  prevPage() {
    this.state.start = parseInt(this.state.start) - 100;
    if(this.state.start < 0) {
        this.state.start = 0;
    }
    this.state.update = true;
    this.refreshResults();
  },
  searchChange(e){
    let val = e.target.value;
    if (val && ILLEGAL_SEARCH_CHARACTERS.test(val)) {
      alert('Illegal character typed/pasted into field');
      return;
    }
    this.setState({ search: val });
  },
  hourChange(e){
    this.state.update = true;
    this.state.h = e.target.value;
    this.refreshResults();
  },
dateChangeFrom(e){
    this.state.update = true;
    this.state.datefrm = e.target.value;
    this.refreshResults();
},

   dateChangeTo(e){
      this.state.update = true;
        this.state.dateto = e.target.value;
        this.refreshResults();
  },
   clearBtnClick() {
     this.state.update = true;
     this.state.datefrm= "";
     this.state.dateto = "";
     this.refreshResults();
    },

  keyPress(e){
   if(e.key == 'Enter'){
     this.state.update = true;
     var q = e.target.value;
     this.setState({search: q});
     this.refreshResults();
   }
  },
  prefChange(e) {
    this.setState({
      fullstr:e.target.checked
    });
    this.state.update = true;
    this.refreshResults();
  },
 render() {
    let wfs = [];
    let dateTime = moment().format(moment.HTML5_FMT.DATETIME_LOCAL_SECONDS);
    let totalHits = 0;
    let found = 0;
    if(this.props.data.hits) {
      wfs = this.props.data.hits;
      totalHits = this.props.data.totalHits;
      found = wfs.length;
    }
      var jobId;
      var orderId;
      for ( var index = 0; index < wfs.length; index++) {
             var res = String(wfs[index].correlationId);
             var replaced=res.replace(/\"/g, "");
             wfs[index].correlationId = replaced;
             var jobidUrn = replaced.split(",").find(function(v){
               return v.indexOf("jobid") > -1;
             });
              if(typeof jobidUrn != "undefined")
              {
                  jobId=jobidUrn.split(":");
                  wfs[index].jobId=jobId[jobId.length - 1];
              }

               var orderidUrn = replaced.split(",").find(function(v){
                        return v.indexOf("orderid") > -1;
                 });

                 if(typeof orderidUrn != "undefined")
                  {
                    orderId=orderidUrn.split(":");
                    wfs[index].orderId=orderId[orderId.length - 1];
                  }
        }

    let start = parseInt(this.state.start);
    let max = start + 100;
    if(found < 100) {
      max = start + found;
    }
    const workflowNames = this.state.workflows?this.state.workflows:[];
    const rangeList = ['All data','This year',
      'Last quarter','This quarter',
      'Last month','This month',
      'Yesterday', 'Today',
      'Last 30 minutes', 'Last 5 minutes'];
    const statusList = ['RUNNING','COMPLETED','RESET','FAILED','TIMED_OUT','TERMINATED','PAUSED','CANCELLED'];
    function linkMaker(cell, row) {
      return <Link to={`/workflow/id/${cell}`}>{cell}</Link>;
    };

    function zeroPad(num) {
      return ('0' + num).slice(-2);
    }
    function formatDate(cell, row){
      if(cell == null || !cell.split) {
        return '';
      }
      let cll = cell;
      let c = cll.split("T");
      let time = c[1].split(":");
      let hh = zeroPad(time[0]);
      let mm = zeroPad(time[1]);
      let ss = zeroPad(time[2].replace("Z",""));

      let dt = c[0] + "T" + hh + ":" + mm + ":" + ss + "Z";

      if(dt == null || dt == ''){
        return '';
      }
      return new Date(dt).toLocaleString('en-US');
    };

    function miniDetails(cell, row){
      return (<ButtonGroup><OverlayTrigger trigger="click" rootClose placement="left" overlay={
        <Popover id={row.workflowId} title="Workflow Details" width={400}>
          <span className="red">{row.reasonForIncompletion == null?'':<span>{row.reasonForIncompletion}<hr/></span>}</span>
          <b>Input</b><br/>
          <span className="small" style={{maxWidth:'400px'}}>{row.input}</span>
          <hr/><b>Output</b><br/>
          <span className="small">{row.output}</span>
          <hr/><br/>
        </Popover>

      }><Button bsSize="xsmall">details</Button></OverlayTrigger></ButtonGroup>);
    };

    const innerGlyphicon = (<i className="fa fa-search"></i>);

    return (
      <div className="ui-content">
        <div>
          <Panel header="Filter Workflows (Press Enter to search)">
          <Grid fluid={true}>
            <Row className="show-grid">
              <Col md={2}>
                <Typeahead ref="range" onChange={this.rangeChange} options={rangeList} placeholder="Today by default" selected={this.state.range} multiple={true} disabled={this.state.h}/>
                &nbsp;<i className="fa fa-angle-up fa-1x"></i>&nbsp;&nbsp;<label className="small nobold">Filter by date range</label>
              </Col>
              <Col md={4}>
                <Input type="input" placeholder="Search" groupClassName="" ref="search" value={this.state.search} labelClassName="" onKeyPress={this.keyPress} onChange={this.searchChange}/>
                &nbsp;<i className="fa fa-angle-up fa-1x"></i>&nbsp;&nbsp;<label className="small nobold">Free Text Query</label>
                &nbsp;&nbsp;<input type="checkbox" checked={this.state.fullstr} onChange={this.prefChange} ref="fullstr"/><label className="small nobold">&nbsp;Search for entire string</label>
                </Col>
              <Col md={5}>
                <Typeahead ref="workflowTypes" onChange={this.workflowTypeChange} options={workflowNames} placeholder="Filter by workflow type" multiple={true} selected={this.state.workflowTypes}/>
                &nbsp;<i className="fa fa-angle-up fa-1x"></i>&nbsp;&nbsp;<label className="small nobold">Filter by Workflow Type</label>
              </Col>
            </Row>
             <Row className="show-grid">
               <Col md={2}>
                             <Typeahead ref="status" onChange={this.statusChange} options={statusList} placeholder="Filter by status" selected={this.state.status} multiple={true}/>
                             &nbsp;<i className="fa fa-angle-up fa-1x"></i>&nbsp;&nbsp;<label className="small nobold">Filter by Workflow Status</label>
               </Col>
                <Col md={2}>
                             <Input className="number-input" type="text" ref="h" groupClassName="inline" labelClassName="" label="" value={this.state.h} onChange={this.hourChange}/>
                             <br/>&nbsp;&nbsp;&nbsp;<i className="fa fa-angle-up fa-1x"></i>&nbsp;&nbsp;<label className="small nobold">Created (in past hours)</label>
               </Col>
               <Col md={2}>
                  <input  name="datefrm"  type="date" value={this.state.datefrm} className="form-control"  onChange={ this.dateChangeFrom } />
                   &nbsp;<i className="fa fa-angle-up fa-1x"></i>&nbsp;&nbsp;<label className="small nobold">From Date</label>
                </Col>
                <Col md={2}>
                   <input  name="dateto"  type="date" value={this.state.dateto} className="form-control"  onChange={ this.dateChangeTo } />
                       &nbsp;<i className="fa fa-angle-up fa-1x"></i>&nbsp;&nbsp;<label className="small nobold">To Date</label>

                  </Col>
                    <Col md={3}>
                         <Button bsSize="small" bsStyle="success" onClick={this.clearBtnClick}>&nbsp;&nbsp;Clear date range</Button> &nbsp;&nbsp;
                          <Button bsSize="small" bsStyle="success" onClick={this.exportcsv}>Export Report</Button>&nbsp;&nbsp;
                          <Button bsSize="medium" bsStyle="success" onClick={this.searchBtnClick} className="fa fa-search search-label">&nbsp;&nbsp;Search</Button>
                     </Col>
             </Row>
          </Grid>
          <form>

          </form>
          </Panel>
        </div>
        <span>Total Workflows Found: <b>{totalHits}</b>, Displaying {this.state.start} <b>to</b> {max}</span>
        <span style={{float:'right'}}>
          {parseInt(this.state.start) >= 100?<a onClick={this.prevPage}><i className="fa fa-backward"></i>&nbsp;Previous Page</a>:''}
          {parseInt(this.state.start) + 100 <= totalHits?<a onClick={this.nextPage}>&nbsp;&nbsp;Next Page&nbsp;<i className="fa fa-forward"></i></a>:''}
        </span>

        <BootstrapTable ref={node => this.table = node} data={wfs} striped={true} hover={true} search={false} csvFileName={"conductorReport_"+dateTime+".csv"}  pagination={false} options={{sizePerPage:100}}>
          <TableHeaderColumn dataField="workflowType" isKey={true} dataAlign="left" dataSort={true}>Workflow</TableHeaderColumn>
          <TableHeaderColumn dataField="workflowId" dataSort={true} dataFormat={linkMaker}>Workflow ID</TableHeaderColumn>
          <TableHeaderColumn dataField="status" dataSort={true}>Status</TableHeaderColumn>
          <TableHeaderColumn dataField="startTime" dataSort={true} dataFormat={formatDate}>Start Time</TableHeaderColumn>
          <TableHeaderColumn dataField="updateTime" dataSort={true} dataFormat={formatDate}>Last Updated</TableHeaderColumn>
          <TableHeaderColumn dataField="endTime" hidden={false} dataFormat={formatDate}>End Time</TableHeaderColumn>
          <TableHeaderColumn dataField="reasonForIncompletion" hidden={false}>Failure Reason</TableHeaderColumn>
          <TableHeaderColumn dataField="input" width="300"  hidden={true}>Input</TableHeaderColumn>
          <TableHeaderColumn dataField="workflowId" width="300" dataFormat={miniDetails} hidden={true}>&nbsp;</TableHeaderColumn>
          <TableHeaderColumn dataField="jobId">jobId</TableHeaderColumn>
          <TableHeaderColumn dataField="orderId">orderId</TableHeaderColumn>
        </BootstrapTable>

        <br/><br/>
      </div>
    );
  }
});
export default connect(state => state.workflow)(Workflow);