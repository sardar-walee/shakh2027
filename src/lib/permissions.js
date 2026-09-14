export const canModerate=role=>role==='super_admin'
export const canPost=(role,section,type)=>role==='super_admin'||section===role||type==='car'
