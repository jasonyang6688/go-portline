export namespace main {
	
	export class ConnectResult {
	    sessionId: string;
	
	    static createFrom(source: any = {}) {
	        return new ConnectResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sessionId = source["sessionId"];
	    }
	}
	export class DiskUsage {
	    filesystem: string;
	    mount: string;
	    used: string;
	    size: string;
	    percent: number;
	
	    static createFrom(source: any = {}) {
	        return new DiskUsage(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.filesystem = source["filesystem"];
	        this.mount = source["mount"];
	        this.used = source["used"];
	        this.size = source["size"];
	        this.percent = source["percent"];
	    }
	}
	export class ProcessUsage {
	    pid: string;
	    user: string;
	    cpu: number;
	    memory: number;
	    command: string;
	
	    static createFrom(source: any = {}) {
	        return new ProcessUsage(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.pid = source["pid"];
	        this.user = source["user"];
	        this.cpu = source["cpu"];
	        this.memory = source["memory"];
	        this.command = source["command"];
	    }
	}
	export class RemoteFile {
	    name: string;
	    path: string;
	    isDir: boolean;
	    size: number;
	    modified: number;
	
	    static createFrom(source: any = {}) {
	        return new RemoteFile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.path = source["path"];
	        this.isDir = source["isDir"];
	        this.size = source["size"];
	        this.modified = source["modified"];
	    }
	}
	export class RemoteListResult {
	    path: string;
	    files: RemoteFile[];
	
	    static createFrom(source: any = {}) {
	        return new RemoteListResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.files = this.convertValues(source["files"], RemoteFile);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class RemoteMetrics {
	    cpuPercent: number;
	    memoryPercent: number;
	    memoryUsedMb: number;
	    memoryTotalMb: number;
	    diskPercent: number;
	    loadAverage: string;
	    uptime: string;
	    hostname: string;
	    kernel: string;
	    processCount: number;
	    diskUsage: DiskUsage[];
	    topProcesses: ProcessUsage[];
	
	    static createFrom(source: any = {}) {
	        return new RemoteMetrics(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.cpuPercent = source["cpuPercent"];
	        this.memoryPercent = source["memoryPercent"];
	        this.memoryUsedMb = source["memoryUsedMb"];
	        this.memoryTotalMb = source["memoryTotalMb"];
	        this.diskPercent = source["diskPercent"];
	        this.loadAverage = source["loadAverage"];
	        this.uptime = source["uptime"];
	        this.hostname = source["hostname"];
	        this.kernel = source["kernel"];
	        this.processCount = source["processCount"];
	        this.diskUsage = this.convertValues(source["diskUsage"], DiskUsage);
	        this.topProcesses = this.convertValues(source["topProcesses"], ProcessUsage);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class TransferStartResult {
	    transferId: string;
	
	    static createFrom(source: any = {}) {
	        return new TransferStartResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.transferId = source["transferId"];
	    }
	}

}

export namespace store {
	
	export class Connection {
	    id: number;
	    name: string;
	    host: string;
	    port: number;
	    user: string;
	    password?: string;
	    keyPath: string;
	    kind: string;
	    wslDistro: string;
	    env: string;
	    groupName: string;
	
	    static createFrom(source: any = {}) {
	        return new Connection(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.host = source["host"];
	        this.port = source["port"];
	        this.user = source["user"];
	        this.password = source["password"];
	        this.keyPath = source["keyPath"];
	        this.kind = source["kind"];
	        this.wslDistro = source["wslDistro"];
	        this.env = source["env"];
	        this.groupName = source["groupName"];
	    }
	}
	export class QuickCommand {
	    id: number;
	    label: string;
	    command: string;
	    connectionId?: number;
	    sortOrder: number;
	
	    static createFrom(source: any = {}) {
	        return new QuickCommand(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.label = source["label"];
	        this.command = source["command"];
	        this.connectionId = source["connectionId"];
	        this.sortOrder = source["sortOrder"];
	    }
	}

}

