import type {NextConfig} from 'next';
const config:NextConfig={poweredByHeader:false,distDir:process.env.FAMILYMIND_TEST==='1'?'.next-test':'.next',webpack(config){config.resolve.alias['@']=require('path').resolve('./src');return config;},async headers(){return [{source:'/:path*',headers:[{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'no-referrer'},{key:'X-Frame-Options',value:'DENY'}]},{source:'/api/:path*',headers:[{key:'Cache-Control',value:'private, no-store'}]}];}};
export default config;
