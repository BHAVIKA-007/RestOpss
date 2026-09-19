import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
    vus: 300,
    duration: "5s",
};

export default function () {
    const res = http.get("http://localhost:5000/api/load-test");

    check(res, {
        "status is 200": (r) => r.status === 200,
    });

    sleep(0.1);
}