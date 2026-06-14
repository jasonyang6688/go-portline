export namespace domain {
	
	export class AppSettings {
	    theme: string;
	    accent: string;
	    fontSize: number;
	    transparency: boolean;
	    ligatures: boolean;
	    copyOnSelect: boolean;
	    sshAgent: boolean;
	    defaultKeyPath: string;
	    knownHostsPath: string;
	
	    static createFrom(source: any = {}) {
	        return new AppSettings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.theme = source["theme"];
	        this.accent = source["accent"];
	        this.fontSize = source["fontSize"];
	        this.transparency = source["transparency"];
	        this.ligatures = source["ligatures"];
	        this.copyOnSelect = source["copyOnSelect"];
	        this.sshAgent = source["sshAgent"];
	        this.defaultKeyPath = source["defaultKeyPath"];
	        this.knownHostsPath = source["knownHostsPath"];
	    }
	}
	export class CommandHistoryEntry {
	    id: string;
	    sessionId: string;
	    connectionId: string;
	    connectionName: string;
	    command: string;
	    // Go type: time
	    createdAt: any;
	
	    static createFrom(source: any = {}) {
	        return new CommandHistoryEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.sessionId = source["sessionId"];
	        this.connectionId = source["connectionId"];
	        this.connectionName = source["connectionName"];
	        this.command = source["command"];
	        this.createdAt = this.convertValues(source["createdAt"], null);
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
	export class CommandHistoryFilter {
	    connectionId: string;
	    sessionId: string;
	    limit: number;
	
	    static createFrom(source: any = {}) {
	        return new CommandHistoryFilter(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.connectionId = source["connectionId"];
	        this.sessionId = source["sessionId"];
	        this.limit = source["limit"];
	    }
	}
	export class Connection {
	    id: string;
	    name: string;
	    host: string;
	    port: number;
	    username: string;
	    authType: string;
	    password: string;
	    keyPath: string;
	    insecureIgnoreHostKey: boolean;
	    group: string;
	    tags: string[];
	    // Go type: time
	    createdAt: any;
	    // Go type: time
	    updatedAt: any;
	
	    static createFrom(source: any = {}) {
	        return new Connection(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.host = source["host"];
	        this.port = source["port"];
	        this.username = source["username"];
	        this.authType = source["authType"];
	        this.password = source["password"];
	        this.keyPath = source["keyPath"];
	        this.insecureIgnoreHostKey = source["insecureIgnoreHostKey"];
	        this.group = source["group"];
	        this.tags = source["tags"];
	        this.createdAt = this.convertValues(source["createdAt"], null);
	        this.updatedAt = this.convertValues(source["updatedAt"], null);
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
	export class FileContent {
	    name: string;
	    path: string;
	    content: string;
	    language: string;
	    size: number;
	    // Go type: time
	    modTime: any;
	    isBinary: boolean;
	
	    static createFrom(source: any = {}) {
	        return new FileContent(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.path = source["path"];
	        this.content = source["content"];
	        this.language = source["language"];
	        this.size = source["size"];
	        this.modTime = this.convertValues(source["modTime"], null);
	        this.isBinary = source["isBinary"];
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
	export class FileEntry {
	    name: string;
	    path: string;
	    size: number;
	    sizeLabel: string;
	    // Go type: time
	    modTime: any;
	    isDir: boolean;
	
	    static createFrom(source: any = {}) {
	        return new FileEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.path = source["path"];
	        this.size = source["size"];
	        this.sizeLabel = source["sizeLabel"];
	        this.modTime = this.convertValues(source["modTime"], null);
	        this.isDir = source["isDir"];
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
	export class FileListInput {
	    sessionId: string;
	    side: string;
	    path: string;
	
	    static createFrom(source: any = {}) {
	        return new FileListInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sessionId = source["sessionId"];
	        this.side = source["side"];
	        this.path = source["path"];
	    }
	}
	export class FileMutationInput {
	    sessionId: string;
	    side: string;
	    path: string;
	
	    static createFrom(source: any = {}) {
	        return new FileMutationInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sessionId = source["sessionId"];
	        this.side = source["side"];
	        this.path = source["path"];
	    }
	}
	export class FileReadInput {
	    sessionId: string;
	    side: string;
	    path: string;
	
	    static createFrom(source: any = {}) {
	        return new FileReadInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sessionId = source["sessionId"];
	        this.side = source["side"];
	        this.path = source["path"];
	    }
	}
	export class FileRenameInput {
	    sessionId: string;
	    side: string;
	    path: string;
	    newPath: string;
	
	    static createFrom(source: any = {}) {
	        return new FileRenameInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sessionId = source["sessionId"];
	        this.side = source["side"];
	        this.path = source["path"];
	        this.newPath = source["newPath"];
	    }
	}
	export class FileSaveInput {
	    sessionId: string;
	    side: string;
	    path: string;
	    content: string;
	
	    static createFrom(source: any = {}) {
	        return new FileSaveInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sessionId = source["sessionId"];
	        this.side = source["side"];
	        this.path = source["path"];
	        this.content = source["content"];
	    }
	}
	export class FileTransferInput {
	    sessionId: string;
	    direction: string;
	    localPath: string;
	    remotePath: string;
	    overwrite: boolean;
	
	    static createFrom(source: any = {}) {
	        return new FileTransferInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sessionId = source["sessionId"];
	        this.direction = source["direction"];
	        this.localPath = source["localPath"];
	        this.remotePath = source["remotePath"];
	        this.overwrite = source["overwrite"];
	    }
	}
	export class FileTransferResult {
	    direction: string;
	    localPath: string;
	    remotePath: string;
	    bytesTransferred: number;
	
	    static createFrom(source: any = {}) {
	        return new FileTransferResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.direction = source["direction"];
	        this.localPath = source["localPath"];
	        this.remotePath = source["remotePath"];
	        this.bytesTransferred = source["bytesTransferred"];
	    }
	}
	export class ProcessMetric {
	    name: string;
	    pid: number;
	    cpuPercent: number;
	    memory: string;
	    memoryPercent: number;
	
	    static createFrom(source: any = {}) {
	        return new ProcessMetric(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.pid = source["pid"];
	        this.cpuPercent = source["cpuPercent"];
	        this.memory = source["memory"];
	        this.memoryPercent = source["memoryPercent"];
	    }
	}
	export class MonitorSnapshot {
	    sessionId: string;
	    cpuPercent: number;
	    memoryPercent: number;
	    diskPercent: number;
	    loadAverage: string;
	    processes: ProcessMetric[];
	    // Go type: time
	    updatedAt: any;
	
	    static createFrom(source: any = {}) {
	        return new MonitorSnapshot(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sessionId = source["sessionId"];
	        this.cpuPercent = source["cpuPercent"];
	        this.memoryPercent = source["memoryPercent"];
	        this.diskPercent = source["diskPercent"];
	        this.loadAverage = source["loadAverage"];
	        this.processes = this.convertValues(source["processes"], ProcessMetric);
	        this.updatedAt = this.convertValues(source["updatedAt"], null);
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
	export class TerminalSize {
	    cols: number;
	    rows: number;
	
	    static createFrom(source: any = {}) {
	        return new TerminalSize(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.cols = source["cols"];
	        this.rows = source["rows"];
	    }
	}
	export class OpenSessionInput {
	    connectionId: string;
	    password: string;
	    size: TerminalSize;
	    insecureIgnoreHostKey: boolean;
	
	    static createFrom(source: any = {}) {
	        return new OpenSessionInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.connectionId = source["connectionId"];
	        this.password = source["password"];
	        this.size = this.convertValues(source["size"], TerminalSize);
	        this.insecureIgnoreHostKey = source["insecureIgnoreHostKey"];
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
	
	export class RunCommandInput {
	    sessionId: string;
	    command: string;
	    broadcast: boolean;
	
	    static createFrom(source: any = {}) {
	        return new RunCommandInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sessionId = source["sessionId"];
	        this.command = source["command"];
	        this.broadcast = source["broadcast"];
	    }
	}
	export class SaveConnectionInput {
	    id: string;
	    name: string;
	    host: string;
	    port: number;
	    username: string;
	    authType: string;
	    password: string;
	    keyPath: string;
	    insecureIgnoreHostKey: boolean;
	    group: string;
	    tags: string[];
	
	    static createFrom(source: any = {}) {
	        return new SaveConnectionInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.host = source["host"];
	        this.port = source["port"];
	        this.username = source["username"];
	        this.authType = source["authType"];
	        this.password = source["password"];
	        this.keyPath = source["keyPath"];
	        this.insecureIgnoreHostKey = source["insecureIgnoreHostKey"];
	        this.group = source["group"];
	        this.tags = source["tags"];
	    }
	}
	export class SaveSavedCommandInput {
	    id: string;
	    name: string;
	    command: string;
	    description: string;
	    tags: string[];
	
	    static createFrom(source: any = {}) {
	        return new SaveSavedCommandInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.command = source["command"];
	        this.description = source["description"];
	        this.tags = source["tags"];
	    }
	}
	export class SavedCommand {
	    id: string;
	    name: string;
	    command: string;
	    description: string;
	    tags: string[];
	    // Go type: time
	    createdAt: any;
	    // Go type: time
	    updatedAt: any;
	
	    static createFrom(source: any = {}) {
	        return new SavedCommand(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.command = source["command"];
	        this.description = source["description"];
	        this.tags = source["tags"];
	        this.createdAt = this.convertValues(source["createdAt"], null);
	        this.updatedAt = this.convertValues(source["updatedAt"], null);
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
	export class Session {
	    id: string;
	    connectionId: string;
	    name: string;
	    status: string;
	    // Go type: time
	    createdAt: any;
	    // Go type: time
	    lastActiveAt: any;
	
	    static createFrom(source: any = {}) {
	        return new Session(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.connectionId = source["connectionId"];
	        this.name = source["name"];
	        this.status = source["status"];
	        this.createdAt = this.convertValues(source["createdAt"], null);
	        this.lastActiveAt = this.convertValues(source["lastActiveAt"], null);
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
	
	export class TestConnectionInput {
	    connectionId: string;
	    host: string;
	    port: number;
	    username: string;
	    authType: string;
	    password: string;
	    keyPath: string;
	    insecureIgnoreHostKey: boolean;
	
	    static createFrom(source: any = {}) {
	        return new TestConnectionInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.connectionId = source["connectionId"];
	        this.host = source["host"];
	        this.port = source["port"];
	        this.username = source["username"];
	        this.authType = source["authType"];
	        this.password = source["password"];
	        this.keyPath = source["keyPath"];
	        this.insecureIgnoreHostKey = source["insecureIgnoreHostKey"];
	    }
	}

}

