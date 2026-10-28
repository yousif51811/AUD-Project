import {handle} from '@/server/api';
export const runtime='nodejs';
async function route(request:Request,{params}:{params:Promise<{path:string[]}>}){return handle(request,(await params).path);}
export {route as GET,route as POST,route as DELETE};
