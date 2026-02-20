
export interface Branch {
    id: number;
    branches_name: string;
    manager_name: string;
    phone: string;
    address: string;
    city: string;
    region: string;
}

export interface Building {
    id: number;
    branch_id: number;
    name_building: string;
    total_floor: number;
    address: string;
    elec_meter: number;
    water_meter: number;
}

export interface Room {
    id: number;
    building_id: number;
    room_number: string;
    floor: number;
    status: string;
    pet_status: boolean;
    water_unit: number;
    elec_unit: number;
    rent_price: number;
    current_residents: number;
}

export interface User {
    id: number;
    username: string; // Note: Ensure this matches auth schema if using Supabase Auth
    full_name: string;
    phone: string;
    e_mail: string;
    role: string;
    sex: string;
    pet: string;
    identification_number: string;
    identification_type: string;
    nation: string;
    is_primary_tenant: boolean;
    branch_id?: number | null;
}

export interface Contract {
    id: number;
    user_id: number;
    room_id: number;
    contract_number: string;
    status: string;
    move_in: string; // Date string
    move_out: string; // Date string
    durations: number;
    residents: number;
    signed_at: string; // Timestamp string
    water_config_type?: 'unit' | 'fixed'; // 'unit' (default) or 'fixed'
    water_fixed_price?: number; // Price if fixed type
}

export interface Invoice {
    id: number;
    contract_id: number;
    room_deposit_cost: number;
    room_rent_cost?: number;
    room_water_cost: number;
    room_elec_cost: number;
    room_repair_cost: number;
    room_total_cost: number;
    status: string;
    type: string;
    payment_method: string;
    bill_date: string; // Timestamp string
    paid_date: string | null; // Timestamp string or null
    due_date: string; // Timestamp string
    payment_slip: string | null; // Text (URL/Path) or null
}

export interface LogMonthlyRoom {
    id: number;
    room_id: number;
    contract_id: number;
    log_month: string; // Date string
    elec_meter_start: number;
    elec_meter_end: number;
    elec_usage: number;
    elec_cost: number;
    water_meter_start: number;
    water_meter_end: number;
    water_usage: number;
    water_cost: number;
    maintenance_count: number;
    maintenance_cost: number;
    total_revenue: number;
}

export interface SmartMeter {
    id: number;
    room_id: number;
    water_unit: number;
    elec_unit: number;
    recorded_at: string; // Timestamp string
}

export interface MaintenanceRequest {
    id: number;
    room_id: number;
    request_number: string;
    issue_description: string;
    amount: number;
    status_technician: string;
    requested_at: string; // Timestamp string
    path_photos: string;
    completed_at: string | null; // Timestamp string
    technician_id: number | null;
    technician_comment: string | null;
    technician_photo: string | null;
    timeline?: MaintenanceTimeline[];
}

export interface MaintenanceTimeline {
    id: number;
    request_id: number;
    technician_id: number | null;
    status: string;
    comment: string | null;
    photo_url: string | null;
    created_at: string;
}

export interface Equipment {
    id: number;
    room_id: number;
    name: string;
    is_elec: boolean;
    serial_number: string;
    status_equipment: string;
    purchase_at: string; // Date string
    last_maintained_at: string; // Date string
    maintained_count: number;
}

export interface Promotion {
    id: number;
    name: string;
    description: string;
    pictures_path: string;
    type: string;
    point_value: number;
    start_date: string; // Date string
    end_date: string; // Date string
    max_use: number;
    is_active: boolean;
}

export interface Expenses {
    id: number;
    branch_id: number;
    promotion_id: number;
    amount: number;
    category: string;
    note: string;
    paid_at: string; // Timestamp string
}

export interface Income {
    id: number;
    branch_id: number;
    invoice_id: number;
    amount: number;
    category: string;
    note: string;
    received_at: string; // Timestamp string
}
