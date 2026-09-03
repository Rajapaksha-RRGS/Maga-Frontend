import DataTable from "../../../components/DataTable";

export interface User {
    id: number;
    name: string;
    role: string;
}
interface Column<T>{
    header: string;
    accessor: keyof T;
    render?: (item: T) => React.ReactNode;
}   

interface props{
    data : User[];
    onRowClick?: (user:User) => void;
}

const userColumns: Column<User>[]=[
    {header: 'ID', accessor: 'id'},
    {header: 'Full Name', accessor: 'name'},
    {
        header: 'Role',
        accessor: 'role',
        render: (user:User) => <span className="px-2 py-1 bg-blue-100 text-blue-600 rounded font-semibold">{user.role}</span>        
    },
];



export default function UseTable(props : props){
            return(
            <div className="p-6">
                <DataTable columns={userColumns} data={props.data} keyField="id" onRowClick={props.onRowClick} />
            </div>
    )
}