-- Representative VVU Foundation demonstration records.
INSERT INTO public.tenant (id, code, name, "anchorLat", "anchorLon", "createdAt") VALUES
('tenant-gqeberha','GQEBERHA-EDGE-01','Gqeberha Edge Node','-33.9608','25.6022',now());
INSERT INTO public.geographic_anchor (id,"tenantId",name,"wgs84Lat","wgs84Lon",datum,"createdAt") VALUES
('anchor-gqeberha','tenant-gqeberha','Gqeberha WGS84 Anchor','-33.9608','25.6022','WGS84',now()),
('anchor-cape-town','tenant-gqeberha','Cape Town Demonstration Anchor','-33.9249','18.4241','WGS84',now());
INSERT INTO public.physical_node (id,"tenantId","nodeId",name,role,"xCoordMm","yCoordMm","zCoordMm","createdAt") VALUES
('node-pump-01','tenant-gqeberha','pump-01','Gqeberha Inlet Pump','PUMP',0,0,0,now()),
('node-reservoir-01','tenant-gqeberha','reservoir-01','North Reservoir','RESERVOIR',12000,4000,2500,now()),
('node-valve-03','tenant-gqeberha','valve-03','Cape Road Isolation Valve','VALVE',8200,1100,1200,now());
INSERT INTO public.trust_gate_state (id,"gateId",status,beneficiary,shares,"createdAt","updatedAt") VALUES
('gate-3a','gate-3a','PENDING','Gqeberha Community Trust',35,now(),now()),
('gate-3b','gate-3b','CERTIFIED','VVU Foundation',25,now(),now()),
('gate-4a','gate-4a','PENDING','Eastern Cape Field Cooperative',20,now(),now()),
('gate-4b','gate-4b','PENDING','Water Access Programme',20,now(),now()),
('gate-5a','gate-5a','PENDING','Community Compute Pool',15,now(),now());
INSERT INTO public.worm_event (id,seq,source,event,details,"prevHash",hash,"createdAt") VALUES
('worm-0001',1,'vvu-seed','ESTATE_INITIALIZED','Gqeberha edge estate initialized','GENESIS','sha256-demo-0001',now()),
('worm-0002',2,'trust-gate','GATE_REGISTERED','gate-3a registered; MOI allocation 35 percent','sha256-demo-0001','sha256-demo-0002',now()),
('worm-0003',3,'telemetry','NODE_HEALTHY','pump-01 reports nominal operation','sha256-demo-0002','sha256-demo-0003',now()),
('worm-0004',4,'funding','POOL_OPENED','Mk-I prototype fabrication pool opened','sha256-demo-0003','sha256-demo-0004',now()),
('worm-0005',5,'watchdog','RAIL_SWEEP','All sampled watchdog rails responding','sha256-demo-0004','sha256-demo-0005',now());
INSERT INTO public.telemetry_log (id,"tenantId","nodeId","flowRate","pressureHead","apuTemperature","systemState","createdAt") VALUES
('telemetry-0001','tenant-gqeberha','pump-01',18.4,42.2,37.1,'NOMINAL',now()),
('telemetry-0002','tenant-gqeberha','reservoir-01',12.8,38.6,36.8,'NOMINAL',now()),
('telemetry-0003','tenant-gqeberha','valve-03',11.2,35.9,38.2,'WATCH',now()),
('telemetry-0004','tenant-gqeberha','pump-01',18.1,41.9,37.4,'NOMINAL',now()),
('telemetry-0005','tenant-gqeberha','reservoir-01',13.0,39.0,36.9,'NOMINAL',now());
INSERT INTO public.rail_sweep (at,probed,"downCount","downPorts") VALUES
(now(),12,0,'[]'),(now()-interval '1 hour',12,1,'["rail-07"]'),(now()-interval '2 hours',12,0,'[]'),(now()-interval '3 hours',12,0,'[]'),(now()-interval '4 hours',12,0,'[]');
INSERT INTO public.field_kit_capture (id,lecturer,faculty,field,"q1Unverifiable","q2FailurePath","q3TrustCondition","dominantBottleneck","wouldUse","createdAt") VALUES
('capture-001','L. Mbeki','Engineering','Water systems','Pump uptime claim lacks receipt','Manual isolation at valve-03','Signed field log plus telemetry','Maintenance visibility','Yes',now()),
('capture-002','A. Jacobs','Built Environment','Civil infrastructure','Reservoir capacity estimate','Escalate to municipal operator','Independent measurement','Data access','Pilot',now()),
('capture-003','N. Dlamini','Science','Environmental monitoring','Sensor calibration status','Switch to local sampling','Calibration certificate','Instrumentation','Yes',now()),
('capture-004','S. Petersen','Engineering','Controls','Remote alert delivery','Local watchdog fallback','Append-only event record','Connectivity','Yes',now()),
('capture-005','T. Nkomo','Community Development','Water access','Reported community allocation','Community gate review','Published allocation ledger','Governance','Pilot',now());
INSERT INTO public.capability_profile (id,"entityName","tradingAs",province,"csdRegistered","sitaRegistered","provincialRegistered","vatRegistered","createdAt","updatedAt") VALUES
('capability-vvu','VVU Foundation','VVU Estate','Eastern Cape',false,false,false,false,now(),now());
INSERT INTO public.funding_config (id,"updatedAt") VALUES ('pool-mk1',now());
INSERT INTO public.funding_contribution (id) VALUES ('contribution-demo-001');
INSERT INTO public.watchboard_snapshot ("builtAt",signature,"hotCount",rows,"createdAt") VALUES
(now(),'demo-watchboard-signature',0,'[]',now());
